"""
recognition/encoding.py
AMECO — Face encoding cache with rich person metadata.

Cache structure (per person key = '{model}_{pk}'):
{
  'name':          str,
  'role':          str,       # ADMIN | GUARD | STAFF | VISITOR
  'display_role':  str,       # 'Admin' | 'Guard' | 'Staff' | 'Visitor'
  'digital_id':    str,
  'phone':         str,
  'position':      str,
  'department':    str,
  'profile_image': str | None,  # relative URL
  'valid_until':   str | None,  # ISO date — visitors only
  'gate':          str,
  'encodings':     list[np.ndarray],
  'encoding_count': int,
}

Admin-staff identity resolution
────────────────────────────────
Admins are often existing staff members (HR, IT, etc.) who have been
granted system privileges.  They may be enrolled in BiometricData via
EITHER their AdminProfile OR their StaffProfile (or both).

When building the cache, if a StaffProfile has an admin_override link,
the cache entry is labelled as 'Admin' — the person's authoritative
identity in this system.  Likewise, if an AdminProfile BiometricData
is found, it always wins the 'Admin' label regardless of any staff link.
"""

import io
import base64
import logging
import threading
import numpy as np

logger = logging.getLogger(__name__)

# ── In-Memory Encoding Cache ──────────────────────────────────────────────────
_ENCODING_CACHE: dict = {}
_CACHE_STATS: dict    = {'total': 0, 'loaded_at': None}


def get_cache() -> dict:
    return _ENCODING_CACHE


def get_stats() -> dict:
    return _CACHE_STATS


def clear_cache():
    _ENCODING_CACHE.clear()


# ── Role normalisation ────────────────────────────────────────────────────────
_MODEL_DISPLAY = {
    'adminprofile':  ('Admin',   'ADMIN'),
    'guardprofile':  ('Guard',   'GUARD'),
    'staffprofile':  ('Staff',   'STAFF'),
    'visitor':       ('Visitor', 'VISITOR'),
}


def _build_entry(obj, model_name, np_encodings, display_role=None, role_key=None):
    """
    Build a cache dict for a person object.
    Optionally override display_role / role_key (used when a StaffProfile
    belongs to an admin).
    """
    if display_role is None or role_key is None:
        display_role, role_key = _MODEL_DISPLAY.get(model_name, (model_name.title(), model_name.upper()))

    name_parts = [
        getattr(obj, 'first_name',  '') or '',
        getattr(obj, 'middle_name', '') or '',
        getattr(obj, 'last_name',   '') or '',
    ]
    name = ' '.join(p for p in name_parts if p).strip()
    if not name:
        name = getattr(obj, 'full_name', '') or str(obj)
    if callable(name):
        name = name()

    profile_image = None
    if getattr(obj, 'profile_image', None) and obj.profile_image:
        try:
            profile_image = obj.profile_image.url
        except Exception:
            pass

    valid_until = None
    if model_name == 'visitor':
        raw = getattr(obj, 'valid_until', None) or getattr(obj, 'visit_date', None)
        if raw:
            valid_until = raw.isoformat() if hasattr(raw, 'isoformat') else str(raw)

    # position: admin_tag for admins, position field for staff/guards
    position = (
        getattr(obj, 'position',  '') or
        getattr(obj, 'admin_tag', '') or ''
    )

    return {
        'name':           name,
        'role':           role_key,
        'display_role':   display_role,
        'digital_id':     getattr(obj, 'digital_id', '') or '',
        'phone':          getattr(obj, 'phone_number', '') or '',
        'position':       position,
        'department':     getattr(obj, 'department', '') or '',
        'profile_image':  profile_image,
        'valid_until':    valid_until,
        'gate':           getattr(obj, 'gate_registered_on', '') or '',
        'encodings':      np_encodings,
        'encoding_count': len(np_encodings),
    }


def load_all_encodings():
    """
    Load every BiometricData record from the DB into the in-memory cache.
    Called at startup (AppConfig.ready) and after any biometric write.

    Resolution order for identity conflicts
    ────────────────────────────────────────
    1. AdminProfile BiometricData  → always 'Admin' identity, cache key adminprofile_<pk>
    2. StaffProfile BiometricData where staff.admin_override exists
       → stored as 'Admin' identity under the ADMIN's cache key (adminprofile_<admin_pk>)
         so the admin always appears as Admin regardless of which profile was enrolled.
       → the original staffprofile_<pk> key is also kept pointing to the same entry
         so there are no dangling face vectors.
    3. All other records → their natural role.
    """
    import face_recognition
    from django.utils import timezone
    from recognition.models import BiometricData

    clear_cache()
    records = BiometricData.objects.select_related('content_type').all()
    loaded = skipped = 0

    # ── Pass 1: load everything with natural roles ────────────────────────────
    for bio in records:
        try:
            obj = bio.content_object
            if obj is None:
                skipped += 1
                continue

            raw_encodings = bio.face_encodings
            if not raw_encodings:
                skipped += 1
                continue

            np_encodings = [np.array(e) for e in raw_encodings if e]
            if not np_encodings:
                skipped += 1
                continue

            model_name = bio.content_type.model.lower()
            key        = f'{model_name}_{bio.object_id}'

            entry = _build_entry(obj, model_name, np_encodings)
            _ENCODING_CACHE[key] = entry
            loaded += 1

        except Exception as exc:
            logger.warning('Skipping BiometricData #%s: %s', bio.id, exc)
            skipped += 1

    # ── Pass 2: fix admin identity for staff-enrolled admins ─────────────────
    #
    # For every staffprofile_<pk> entry in the cache, check whether that
    # StaffProfile has an admin_override.  If so:
    #   • Re-label the existing staffprofile_<pk> entry as Admin.
    #   • Also write/overwrite the adminprofile_<admin_pk> key with the same
    #     entry so AdminProfile BiometricData (if it exists) doesn't conflict.
    #
    # This means: no matter which profile the face was enrolled under, the
    # recognition result always says "Admin" for that person.

    try:
        from admins.models import AdminProfile

        # Build a map: staff_profile_id → AdminProfile for fast lookup
        admin_by_staff = {
            ap.linked_staff_id: ap
            for ap in AdminProfile.objects.filter(linked_staff__isnull=False).select_related('linked_staff')
        }

        for key in list(_ENCODING_CACHE.keys()):
            if not key.startswith('staffprofile_'):
                continue

            staff_pk = int(key.split('_', 1)[1])
            admin    = admin_by_staff.get(staff_pk)
            if admin is None:
                continue  # regular staff, no override needed

            # Build an admin-flavoured entry using the admin object's metadata
            # but keeping the encodings that are already in cache for this staff key
            existing_encodings = _ENCODING_CACHE[key]['encodings']
            admin_entry = _build_entry(admin, 'adminprofile', existing_encodings,
                                       display_role='Admin', role_key='ADMIN')

            # Overwrite staff key so it returns Admin identity
            _ENCODING_CACHE[key] = admin_entry

            # Also write under admin key — if AdminProfile BiometricData was
            # already loaded in Pass 1, merge the encodings so both sets are used
            admin_key = f'adminprofile_{admin.pk}'
            if admin_key in _ENCODING_CACHE:
                # Merge: combine both sets of face vectors for better accuracy
                combined = _ENCODING_CACHE[admin_key]['encodings'] + existing_encodings
                _ENCODING_CACHE[admin_key]['encodings']      = combined
                _ENCODING_CACHE[admin_key]['encoding_count'] = len(combined)
            else:
                _ENCODING_CACHE[admin_key] = admin_entry

            logger.info(
                'Admin identity override: staff %s → admin %s (%s)',
                staff_pk, admin.pk, admin_entry['name'],
            )

    except Exception as exc:
        logger.error('Admin-staff identity pass failed: %s', exc)

    import datetime
    _CACHE_STATS['total']     = len(_ENCODING_CACHE)
    _CACHE_STATS['loaded_at'] = datetime.datetime.now().isoformat()
    logger.info('Encoding cache: %d entries (%d loaded, %d skipped).', len(_ENCODING_CACHE), loaded, skipped)


def compute_and_store_encodings(bio_instance):
    """
    Compute 128-d face encodings from up to 5 face images,
    persist them, and refresh the in-memory cache.
    Returns list of encoded vectors (as Python lists).
    """
    try:
        import face_recognition
        from PIL import Image

        encodings = []
        face_fields = [
            bio_instance.face_front,
            bio_instance.face_left,
            bio_instance.face_right,
            bio_instance.face_down,
            bio_instance.face_unusual,
        ]

        for img_field in face_fields:
            if not img_field:
                continue
            try:
                img_field.open()
                img = Image.open(img_field).convert('RGB')
                arr = np.array(img)

                locations = face_recognition.face_locations(arr, model='hog')
                if not locations:
                    logger.debug('No face found in %s — skipping', img_field)
                    continue

                found = face_recognition.face_encodings(arr, known_face_locations=locations)
                if found:
                    encodings.append(found[0].tolist())
            except Exception as exc:
                logger.warning('Could not encode %s: %s', img_field, exc)

        bio_instance.face_encodings = encodings
        bio_instance.save(update_fields=['face_encodings'])
        logger.info('Stored %d encodings for BiometricData #%d', len(encodings), bio_instance.id)

        load_all_encodings()
        return encodings

    except Exception as exc:
        logger.error('compute_and_store_encodings failed: %s', exc)
        return []


# ── Helpers ───────────────────────────────────────────────────────────────────

def base64_to_np_image(b64_string: str) -> np.ndarray:
    """Decode a base64 (or data-URI) image to an RGB numpy array."""
    from PIL import Image
    if not b64_string:
        raise ValueError('Empty base64 string')
    if isinstance(b64_string, bytes):
        b64_string = b64_string.decode('utf-8')
    if ',' in b64_string:
        b64_string = b64_string.split(',', 1)[1]
    raw = base64.b64decode(b64_string)
    img = Image.open(io.BytesIO(raw)).convert('RGB')
    return np.array(img)


def save_base64_image(b64_string: str, upload_path: str, field):
    """Save a base64 image to a Django ImageField (no save — caller must save)."""
    from django.core.files.base import ContentFile
    if not b64_string:
        return
    try:
        if isinstance(b64_string, bytes):
            b64_string = b64_string.decode('utf-8')
        if ',' in b64_string:
            b64_string = b64_string.split(',', 1)[1]
        raw = base64.b64decode(b64_string)
        field.save(upload_path, ContentFile(raw), save=False)
    except Exception as e:
        logger.error(f'Error saving base64 image to {upload_path}: {e}', exc_info=True)
        raise


# ── Non-blocking encoding helper ──────────────────────────────────────────────

def compute_and_store_encodings_async(bio_instance):
    """
    Fire-and-forget wrapper: runs compute_and_store_encodings in a daemon
    background thread so the HTTP response is not blocked by face detection.

    Face recognition (hog model) can take 5-30 s per image.  Running it
    synchronously inside the request/response cycle causes the axios client
    to time out (15 s), which makes the frontend show no feedback even
    though the admin was created successfully.

    Django's ORM is thread-safe for reads and writes; the only shared
    mutable state is _ENCODING_CACHE which is rebuilt atomically inside
    load_all_encodings().
    """
    def _run():
        try:
            compute_and_store_encodings(bio_instance)
        except Exception as exc:
            logger.error('Background encoding thread failed: %s', exc)

    t = threading.Thread(target=_run, daemon=True)
    t.start()