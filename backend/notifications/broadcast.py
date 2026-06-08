"""
notifications/broadcast.py
AMECO — Synchronous helpers to push messages through Django Channels
from regular (sync) DRF views.
"""

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


def _send(group: str, payload: dict):
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return
    async_to_sync(channel_layer.group_send)(group, {
        'type': 'notification_message',
        'data': payload,
    })


def broadcast_to_user(username: str, payload: dict):
    """Send a message to a specific user's personal WebSocket group."""
    _send(f'user_{username}', payload)


def broadcast_to_role(role: str, payload: dict):
    """Send a message to all connected users of a given role (admin/guard)."""
    _send(f'role_{role}', payload)


def broadcast_camera_update(payload: dict):
    """Broadcast a camera state change to all connected clients."""
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return
    async_to_sync(channel_layer.group_send)('broadcast', {
        'type': 'camera_update',
        'data': payload,
    })