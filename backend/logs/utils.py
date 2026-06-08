"""
logs/utils.py
AMECO — create_log() helper called from all views, signals, and tasks.
"""

from django.utils import timezone


def to_ethiopian_time_str(dt=None) -> str:
    """
    Convert a UTC/local datetime to Ethiopian time string.
    Ethiopian time = UTC+3, with clock running 6 hours behind Western 12h.
    Display format: DD/MM/YYYY  HH:MM ET
    (Full Ethiopian calendar conversion lives in the frontend; here we
    just produce a readable UTC+3 string tagged as ET.)
    """
    if dt is None:
        dt = timezone.now()
    # Addis Ababa is UTC+3
    from datetime import timezone as tz, timedelta
    eat = dt.astimezone(tz(timedelta(hours=3)))
    return eat.strftime('%d/%m/%Y %H:%M ET')


def create_log(actor=None, action_type='SYSTEM', description='', gate_camera_id='',
               confidence=None, scan_result=''):
    """
    Create an AccessLog entry. Safe to call from anywhere; never raises.
    `actor` should be a CustomUser instance.
    """
    try:
        from logs.models import AccessLog

        kwargs = {
            'action_type':    action_type,
            'description':    description,
            'gate_camera_id': gate_camera_id,
            'ethiopian_time': to_ethiopian_time_str(),
        }
        if confidence is not None:
            kwargs['confidence'] = confidence
        if scan_result:
            kwargs['scan_result'] = scan_result

        if actor and hasattr(actor, 'username'):
            kwargs['actor_username'] = actor.username
            kwargs['actor_role']     = getattr(actor, 'role', '')
            kwargs['actor_name']     = getattr(actor, 'display_name', actor.username)
            profile_img = getattr(actor, 'profile_image', None)
            if profile_img:
                kwargs['actor_image'] = str(profile_img)

        AccessLog.objects.create(**kwargs)
    except Exception:
        pass  # Logging must never break the main request