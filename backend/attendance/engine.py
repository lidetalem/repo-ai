"""
attendance/engine.py — AMECO Attendance Session Engine
=======================================================

record_entry(face_data, gate, confidence)
    Called by the recognition pipeline when a face is ACCEPTED.
    Determines whether this is an ENTRY or EXIT and creates/closes
    AttendanceRecord accordingly.

    Logic:
      1. Look for an open record (exit_time=None) for this digital_id
         created today.
      2. If none found → this is an ENTRY → create new record.
      3. If one found and it was created > MIN_REENTRY_MINUTES ago
         → this is an EXIT → close the record.
      4. If one found but it was just created (debounce window)
         → ignore (same scan twice, camera double-fire).

check_overstay()
    Called by a periodic task (every 60s via Django management command
    or Celery beat).  Scans all open VISITOR records and fires
    OverstayAlert + WebSocket push when time exceeded.
    Also fires a WARNING alert when a visitor hits 80% of their time.
"""

import logging
from datetime import timedelta

from django.utils import timezone

from .models import AttendanceRecord, OverstayAlert, _eth_time_str

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────
MIN_REENTRY_MINUTES = 5     # debounce: ignore re-scan within this window
WARNING_THRESHOLD   = 0.80  # fire WARNING alert at 80% of allowed time
DEFAULT_VISITOR_ALLOWED_MINUTES = 120   # 2 hours if not set on profile


def record_entry(face_data: dict, gate: str, confidence: float) -> dict:
    """
    Process a successful face recognition hit.

    face_data keys expected (from recognition engine):
        digital_id, person_name (or name), person_type (or role),
        display_role, profile_image, valid_until (visitors)

    Returns dict with keys:
        action          — 'ENTRY' | 'EXIT' | 'IGNORED'
        record_id       — AttendanceRecord pk
        duration_minutes — (exit only) time spent inside
        status          — record status string
        message         — human-readable summary
    """
    digital_id  = face_data.get('digital_id', '')
    person_name = face_data.get('name') or face_data.get('person_name', '')
    person_type = _resolve_type(face_data.get('role', ''))
    person_role = face_data.get('display_role', '')
    profile_img = face_data.get('profile_image', '') or ''

    # Allowed minutes for visitors
    allowed_min = _visitor_allowed(face_data)

    now = timezone.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # Find any open record for this person created today
    open_record = (
        AttendanceRecord.objects
        .filter(digital_id=digital_id, entry_time__gte=today_start, exit_time__isnull=True)
        .order_by('-entry_time')
        .first()
    )

    # ── Case 1: no open record → ENTRY ───────────────────────────────────────
    if open_record is None:
        rec = AttendanceRecord.objects.create(
            person_type      = person_type,
            digital_id       = digital_id,
            person_name      = person_name,
            person_role      = person_role,
            profile_image    = str(profile_img),
            entry_time       = now,
            entry_eth_time   = _eth_time_str(now),
            gate_camera_id   = gate,
            entry_confidence = confidence,
            allowed_minutes  = allowed_min,
            status           = 'INSIDE',
        )
        logger.info('ENTRY recorded: %s (%s)', person_name, digital_id)
        return {
            'action':    'ENTRY',
            'record_id': rec.id,
            'status':    rec.status,
            'message':   f'{person_name} entered at {rec.entry_eth_time}',
        }

    # ── Case 2: open record exists but scan is within debounce window ─────────
    elapsed = (now - open_record.entry_time).total_seconds() / 60
    if elapsed < MIN_REENTRY_MINUTES:
        return {
            'action':    'IGNORED',
            'record_id': open_record.id,
            'status':    open_record.status,
            'message':   'Duplicate scan — already recorded as inside',
        }

    # ── Case 3: open record + past debounce → EXIT ────────────────────────────
    open_record.close(exit_time=now, exit_confidence=confidence, gate=gate)
    dur = open_record.duration_minutes
    logger.info('EXIT recorded: %s (%s) — %d min inside', person_name, digital_id, dur)

    return {
        'action':           'EXIT',
        'record_id':        open_record.id,
        'duration_minutes': dur,
        'status':           open_record.status,
        'message': (
            f'{person_name} exited after {dur} minutes'
            + (' — ⚠ OVERSTAY' if open_record.status == 'OVERSTAY' else '')
        ),
    }


def check_overstay():
    """
    Scan all open VISITOR records and fire OverstayAlert where needed.
    Should be called every ~60 seconds by a periodic task.
    Returns list of alert dicts for logging.
    """
    from notifications.broadcast import broadcast_to_role
    from notifications.models    import Notification
    from authentication.models   import CustomUser

    now     = timezone.now()
    alerts  = []
    inside  = AttendanceRecord.objects.filter(
        person_type='VISITOR',
        exit_time__isnull=True,
        status='INSIDE',
    ).select_related()

    for rec in inside:
        if not rec.allowed_minutes:
            continue

        elapsed = int((now - rec.entry_time).total_seconds() / 60)
        ratio   = elapsed / rec.allowed_minutes

        # Already alerted at this severity? Skip.
        already_critical = rec.alerts.filter(severity='CRITICAL', resolved=False).exists()
        already_warning  = rec.alerts.filter(severity='WARNING').exists()

        if ratio >= 1.0 and not already_critical:
            # CRITICAL — visitor has exceeded their allowed time
            minutes_over = elapsed - rec.allowed_minutes
            alert = OverstayAlert.objects.create(
                record          = rec,
                digital_id      = rec.digital_id,
                person_name     = rec.person_name,
                person_type     = rec.person_type,
                gate_camera_id  = rec.gate_camera_id,
                severity        = 'CRITICAL',
                minutes_over    = minutes_over,
                allowed_minutes = rec.allowed_minutes,
                duration_minutes= elapsed,
            )
            rec.status = 'OVERSTAY'
            rec.save(update_fields=['status'])

            payload = {
                'type':         'OVERSTAY_ALERT',
                'severity':     'CRITICAL',
                'digital_id':   rec.digital_id,
                'person_name':  rec.person_name,
                'gate':         rec.gate_camera_id,
                'elapsed_min':  elapsed,
                'allowed_min':  rec.allowed_minutes,
                'minutes_over': minutes_over,
                'alert_id':     alert.id,
                'message': (
                    f'⚠ SECURITY CHECK REQUIRED — {rec.person_name} '
                    f'has been inside for {elapsed} minutes '
                    f'({minutes_over} min over allowed limit).'
                ),
            }
            broadcast_to_role('admin', payload)
            broadcast_to_role('guard', payload)
            _save_notification(payload)
            alerts.append(payload)
            logger.warning('CRITICAL overstay: %s %+d min', rec.person_name, minutes_over)

        elif WARNING_THRESHOLD <= ratio < 1.0 and not already_warning and not already_critical:
            # WARNING — approaching limit
            pct = int(ratio * 100)
            alert = OverstayAlert.objects.create(
                record          = rec,
                digital_id      = rec.digital_id,
                person_name     = rec.person_name,
                person_type     = rec.person_type,
                gate_camera_id  = rec.gate_camera_id,
                severity        = 'WARNING',
                minutes_over    = 0,
                allowed_minutes = rec.allowed_minutes,
                duration_minutes= elapsed,
            )
            payload = {
                'type':        'OVERSTAY_ALERT',
                'severity':    'WARNING',
                'digital_id':  rec.digital_id,
                'person_name': rec.person_name,
                'gate':        rec.gate_camera_id,
                'elapsed_min': elapsed,
                'allowed_min': rec.allowed_minutes,
                'alert_id':    alert.id,
                'message': (
                    f'⏳ Visitor {rec.person_name} has used {pct}% of allowed time '
                    f'({elapsed}/{rec.allowed_minutes} min) at {rec.gate_camera_id}.'
                ),
            }
            broadcast_to_role('admin', payload)
            alerts.append(payload)
            logger.info('WARNING overstay: %s at %d%%', rec.person_name, pct)

    return alerts


# ── Helpers ───────────────────────────────────────────────────────────────────

def _resolve_type(role: str) -> str:
    mapping = {
        'ADMIN': 'ADMIN', 'Admin': 'ADMIN',
        'STAFF': 'STAFF', 'Staff': 'STAFF',
        'GUARD': 'GUARD', 'Guard': 'GUARD',
        'VISITOR': 'VISITOR', 'Visitor': 'VISITOR',
    }
    return mapping.get(role, 'STAFF')


def _visitor_allowed(face_data: dict) -> int | None:
    """
    Determine allowed minutes for a visitor.
    Priority: face_data['allowed_minutes'] → valid_until field → default.
    """
    if face_data.get('role') not in ('VISITOR', 'Visitor'):
        return None

    if face_data.get('allowed_minutes'):
        return int(face_data['allowed_minutes'])

    # If valid_until is a datetime (not just a date), compute from now
    valid_until = face_data.get('valid_until')
    if valid_until:
        try:
            from datetime import date
            exp = date.fromisoformat(str(valid_until)[:10])
            today = date.today()
            if exp >= today:
                # allowed until end of that date
                from datetime import datetime, timezone as tz
                end = datetime(exp.year, exp.month, exp.day, 23, 59, tzinfo=tz.utc)
                remaining = int((end - timezone.now()).total_seconds() / 60)
                return max(remaining, DEFAULT_VISITOR_ALLOWED_MINUTES)
        except Exception:
            pass

    return DEFAULT_VISITOR_ALLOWED_MINUTES


def _save_notification(payload: dict):
    """Persist the alert as a Notification for all admins."""
    try:
        from notifications.models import Notification
        from authentication.models import CustomUser
        admins = CustomUser.objects.filter(role='admin', is_active=True)
        Notification.objects.bulk_create([
            Notification(
                recipient    = admin,
                title        = f'{"SECURITY ALERT" if payload["severity"] == "CRITICAL" else "Visitor Warning"}: {payload["person_name"]}',
                message      = payload['message'],
                type         = 'ALERT' if payload['severity'] == 'CRITICAL' else 'WARNING',
                is_read      = False,
                data         = payload,
            )
            for admin in admins
        ])
    except Exception as exc:
        logger.error('Failed to save overstay notification: %s', exc)
