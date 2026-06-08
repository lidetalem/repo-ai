"""
recognition/views.py — AMECO Multi-Person Recognition Engine
=============================================================

FaceScanView        POST /api/recognition/scan/        (primary endpoint)
MultiFaceScanView   POST /api/recognition/scan/multi/  (multi-person, same logic)
ReloadEncodingCacheView  POST /api/recognition/reload/
CacheStatsView           GET  /api/recognition/stats/

How the scan pipeline works
---------------------------
1. Decode the incoming base64 JPEG frame.
2. Find ALL face locations in one pass (HOG model — fast on CPU).
3. For every valid face, compute a 128-d encoding in a single batched call.
4. Match each encoding against the in-memory cache in parallel threads.
5. Return an array of results with bounding-box percentages so the frontend
   can draw labelled rectangles on a canvas overlay.

Performance choices
-------------------
• MIN_FACE_AREA = 0.008  — accepts faces as small as ~1% of the frame.
  The old value (0.04) was rejecting most real-world entrance-camera shots.
• num_jitters = 1  — fastest encoding without sacrificing meaningful accuracy.
• model = 'small'  — 5x faster than 'large'; accuracy difference is negligible
  when the enrolled images already include multiple angles.
• ThreadPoolExecutor — each face is matched against the full cache in its own
  thread, so N people are processed in roughly the time it takes to match one.
• Caches are kept as numpy arrays (loaded once at startup, never re-decoded).
"""

import logging
import numpy as np
import redis
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date

from django.conf import settings
from rest_framework.views       import APIView
from rest_framework.response    import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.throttling  import UserRateThrottle

from authentication.permissions import IsAdminOrGuard
from .encoding import get_cache, get_stats, base64_to_np_image, load_all_encodings
from logs.utils import create_log

logger = logging.getLogger(__name__)

# ── Tunables ──────────────────────────────────────────────────────────────────
BASE_TOLERANCE    = 0.52   # used when person has ≥4 enrolled face angles
RELAXED_TOLERANCE = 0.58   # used when fewer angles enrolled — more lenient
MIN_FACE_AREA     = 0.008  # fraction of frame; was 0.04 — that was too strict
MAX_ATTEMPTS      = 4
BLOCK_SECONDS     = 300
MAX_WORKERS       = 8      # parallel threads for multi-face matching

_redis = redis.Redis.from_url(
    getattr(settings, 'CELERY_BROKER_URL', 'redis://localhost:6379'),
    decode_responses=True,
    socket_connect_timeout=2,
)


class FaceScanThrottle(UserRateThrottle):
    scope = 'face_scan'


# ── Helpers ───────────────────────────────────────────────────────────────────

def _tolerance(entry):
    return BASE_TOLERANCE if entry.get('encoding_count', 0) >= 4 else RELAXED_TOLERANCE


def _visitor_expired(entry):
    if entry.get('role') != 'VISITOR':
        return False
    vu = entry.get('valid_until')
    if not vu:
        return False
    try:
        return date.fromisoformat(vu[:10]) < date.today()
    except Exception:
        return False


def _match(enc, cache):
    """
    Find the closest match in the encoding cache for a single face vector.
    Uses face_recognition.face_distance() which is a fast vectorised L2 norm.
    Returns (key, entry, distance) or None.
    """
    import face_recognition
    best_key   = None
    best_entry = None
    best_dist  = 1.0

    for key, entry in cache.items():
        stored = entry.get('encodings', [])
        if not stored:
            continue
        try:
            dists    = face_recognition.face_distance(stored, enc)
            min_dist = float(np.min(dists))
            if min_dist < best_dist and min_dist <= _tolerance(entry):
                best_dist  = min_dist
                best_key   = key
                best_entry = entry
        except Exception:
            continue

    return (best_key, best_entry, best_dist) if best_key else None


def _box_pct(loc, h, w):
    """Convert pixel (top,right,bottom,left) → percentage dict."""
    t, r, b, l = loc
    return {
        'top':    round(t / h * 100, 2),
        'right':  round(r / w * 100, 2),
        'bottom': round(b / h * 100, 2),
        'left':   round(l / w * 100, 2),
    }


def _accepted_payload(entry, dist, box):
    return {
        'result':        'ACCEPTED',
        'box':           box,
        'name':          entry['name'],
        'role':          entry['role'],
        'display_role':  entry['display_role'],
        'digital_id':    entry['digital_id'],
        'phone':         entry.get('phone', ''),
        'position':      entry.get('position', ''),
        'department':    entry.get('department', ''),
        'profile_image': entry.get('profile_image'),
        'valid_until':   entry.get('valid_until'),
        'gate':          entry.get('gate', ''),
        'confidence':    round((1 - dist) * 100, 1),
    }


def _do_scan(img_array, camera_id, user):
    """
    Core scan logic shared by both endpoints.
    Returns a list of per-face result dicts sorted left-to-right.
    """
    import face_recognition

    h, w       = img_array.shape[:2]
    frame_area = w * h + 1e-6

    # Detect all faces in one pass
    try:
        locs = face_recognition.face_locations(img_array, model='hog')
    except Exception as exc:
        logger.error('face_locations failed: %s', exc)
        return [], str(exc)

    if not locs:
        return [], None

    # Drop faces smaller than MIN_FACE_AREA (distant background faces / noise)
    valid_locs = [
        loc for loc in locs
        if ((loc[1] - loc[3]) * (loc[2] - loc[0])) / frame_area >= MIN_FACE_AREA
    ]
    if not valid_locs:
        return [], None

    # Encode all valid faces in one batched DNN call
    try:
        encs = face_recognition.face_encodings(
            img_array,
            known_face_locations=valid_locs,
            num_jitters=1,
            model='small',
        )
    except Exception as exc:
        logger.error('face_encodings failed: %s', exc)
        return [], str(exc)

    # Warm cache if empty
    cache = get_cache()
    if not cache:
        load_all_encodings()
        cache = get_cache()

    # Match each face in parallel
    results = [None] * len(valid_locs)

    def worker(idx, enc, loc):
        box   = _box_pct(loc, h, w)
        match = _match(enc, cache)
        return idx, match, box

    with ThreadPoolExecutor(max_workers=min(len(valid_locs), MAX_WORKERS)) as pool:
        futs = {pool.submit(worker, i, enc, loc): i
                for i, (enc, loc) in enumerate(zip(encs, valid_locs))}
        for fut in as_completed(futs):
            try:
                idx, match, box = fut.result()
            except Exception as exc:
                logger.warning('worker error: %s', exc)
                continue

            if match:
                key, entry, dist = match
                if _visitor_expired(entry):
                    results[idx] = {
                        'result':       'VISITOR_EXPIRED',
                        'box':          box,
                        'name':         entry['name'],
                        'digital_id':   entry['digital_id'],
                        'display_role': entry['display_role'],
                        'valid_until':  entry['valid_until'],
                        'confidence':   round((1 - dist) * 100, 1),
                    }
                else:
                    results[idx] = _accepted_payload(entry, dist, box)
            else:
                results[idx] = {'result': 'UNKNOWN', 'box': box}

    faces = [r for r in results if r is not None]

    # Sort left-to-right (natural reading order)
    faces.sort(key=lambda f: f.get('box', {}).get('left', 0))

    # Logging
    accepted = [f for f in faces if f['result'] == 'ACCEPTED']
    unknowns = [f for f in faces if f['result'] == 'UNKNOWN']

    for p in accepted:
        try:
            _redis.delete(f'unknown_attempts:{camera_id}')
        except Exception:
            pass
        create_log(
            actor=user,
            action_type='SCAN_ACCEPTED',
            description=f'{p["name"]} ({p["display_role"]}) at {camera_id} — {p["confidence"]}% confidence',
            confidence=p['confidence'],
            gate_camera_id=camera_id,
        )

    if unknowns:
        attempt_key = f'unknown_attempts:{camera_id}'
        try:
            count = int(_redis.get(attempt_key) or 0) + len(unknowns)
            _redis.setex(attempt_key, BLOCK_SECONDS, count)
        except Exception:
            count = len(unknowns)
        action = 'ATTEMPT_LIMIT' if count >= MAX_ATTEMPTS else 'SCAN_REJECTED'
        create_log(
            actor=user,
            action_type=action,
            description=f'{len(unknowns)} unknown face(s) at {camera_id}',
            gate_camera_id=camera_id,
        )

    return faces, None


# ── Primary endpoint — returns single best result (frontend default) ──────────

class FaceScanView(APIView):
    """
    POST /api/recognition/scan/
    Detects all faces, returns the best single result for backward compatibility.
    Also includes the `faces` array so upgraded frontends can use multi-person mode.
    """
    permission_classes = [IsAdminOrGuard]
    throttle_classes   = [FaceScanThrottle]

    def post(self, request):
        b64 = request.data.get('image')
        cam = str(request.data.get('camera_id', 'UNKNOWN'))

        if not b64:
            return Response({'result': 'ERROR', 'message': 'No image provided.'}, status=400)

        try:
            img = base64_to_np_image(b64)
        except Exception as exc:
            return Response({'result': 'ERROR', 'message': f'Decode failed: {exc}'}, status=400)

        faces, err = _do_scan(img, cam, request.user)

        if err:
            return Response({'result': 'ERROR', 'message': err}, status=500)

        if not faces:
            return Response({'result': 'REJECTED', 'message': 'No face detected.', 'faces': []})

        accepted = [f for f in faces if f['result'] == 'ACCEPTED']
        if accepted:
            best = max(accepted, key=lambda f: f.get('confidence', 0))
            return Response({**best, 'faces': faces})

        expired = [f for f in faces if f['result'] == 'VISITOR_EXPIRED']
        if expired:
            return Response({**expired[0], 'faces': faces, 'message': 'Visitor access has expired.'})

        # All unknown
        try:
            count = int(_redis.get(f'unknown_attempts:{cam}') or 1)
            ttl = _redis.ttl(f'unknown_attempts:{cam}')
            seconds_remaining = max(0, ttl) if ttl and ttl > 0 else 0
        except Exception:
            count = 1
            seconds_remaining = None

        response_data = {
            'result':        'REJECTED',
            'message':       'Face not recognised.',
            'attempts':      count,
            'attempts_left': max(0, MAX_ATTEMPTS - count),
            'faces':         faces,
        }
        if seconds_remaining is not None and count >= MAX_ATTEMPTS:
            response_data['seconds_remaining'] = seconds_remaining

        return Response(response_data)


# ── Multi-face endpoint — returns full array ──────────────────────────────────

class MultiFaceScanView(APIView):
    """
    POST /api/recognition/scan/multi/
    Returns all detected faces simultaneously with bounding-box percentages.
    """
    permission_classes = [IsAdminOrGuard]
    throttle_classes   = [FaceScanThrottle]

    def post(self, request):
        b64 = request.data.get('image')
        cam = str(request.data.get('camera_id', 'UNKNOWN'))

        if not b64:
            return Response({'error': 'No image.'}, status=400)

        try:
            img = base64_to_np_image(b64)
        except Exception as exc:
            return Response({'error': f'Decode failed: {exc}'}, status=400)

        faces, err = _do_scan(img, cam, request.user)

        if err:
            return Response({'error': err, 'faces': []}, status=500)

        return Response({'faces': faces, 'face_count': len(faces)})


# ── Admin utilities ───────────────────────────────────────────────────────────

class ReloadEncodingCacheView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if getattr(request.user, 'role', None) != 'admin':
            return Response({'detail': 'Admin only.'}, status=403)
        load_all_encodings()
        s = get_stats()
        return Response({'detail': f'Reloaded — {s["total"]} persons.', **s})


class CacheStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if getattr(request.user, 'role', None) != 'admin':
            return Response({'detail': 'Admin only.'}, status=403)
        s     = get_stats()
        cache = get_cache()
        roles = {}
        for e in cache.values():
            r = e.get('display_role', 'Unknown')
            roles[r] = roles.get(r, 0) + 1
        return Response({**s, 'by_role': roles})
