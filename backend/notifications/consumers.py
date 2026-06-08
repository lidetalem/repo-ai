"""
notifications/consumers.py
AMECO — Django Channels WebSocket consumer.

Each logged-in user connects to their own personal room:
  ws://host/ws/notifications/{username}/

Messages are JSON objects with a 'type' field.
"""

import json
from channels.generic.websocket import AsyncWebsocketConsumer


class NotificationConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        self.user = self.scope.get('user')
        if not self.user or not self.user.is_authenticated:
            await self.close()
            return

        # Personal channel group per user
        self.personal_group = f'user_{self.user.username}'
        # Role-based group (e.g. all admins)
        self.role_group = f'role_{self.user.role}'

        await self.channel_layer.group_add(self.personal_group, self.channel_name)
        await self.channel_layer.group_add(self.role_group, self.channel_name)
        await self.channel_layer.group_add('broadcast', self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'personal_group'):
            await self.channel_layer.group_discard(self.personal_group, self.channel_name)
            await self.channel_layer.group_discard(self.role_group, self.channel_name)
            await self.channel_layer.group_discard('broadcast', self.channel_name)

    async def receive(self, text_data):
        # Clients can send a ping; we echo back a pong
        try:
            data = json.loads(text_data)
            if data.get('type') == 'ping':
                await self.send(text_data=json.dumps({'type': 'pong'}))
        except Exception:
            pass

    # ── Channel layer message handlers ─────────────────────────────────────────
    # Django Channels calls these when a message is sent to any group this
    # consumer belongs to.  The method name maps to event['type'] with dots
    # replaced by underscores.

    async def notification_message(self, event):
        """Forward any notification payload to the WebSocket client."""
        await self.send(text_data=json.dumps(event.get('data', event)))

    async def camera_update(self, event):
        await self.send(text_data=json.dumps(event.get('data', event)))

    async def broadcast_message(self, event):
        await self.send(text_data=json.dumps(event.get('data', event)))