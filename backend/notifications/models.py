"""
notifications/models.py
AMECO — Notification model (persisted so they survive page refreshes).
"""

from django.db import models
from authentication.models import CustomUser


class Notification(models.Model):
    TYPE_CHOICES = [
        ('new_request',      'New Visitor Request'),
        ('request_approved', 'Request Approved'),
        ('request_denied',   'Request Denied'),
        ('camera_update',    'Camera Update'),
        ('system',           'System'),
    ]

    recipient         = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='notifications')
    notification_type = models.CharField(max_length=30, choices=TYPE_CHOICES)
    title             = models.CharField(max_length=255, null=True, blank=True)
    message           = models.TextField(blank=True)
    is_read           = models.BooleanField(default=False)
    dismissed         = models.BooleanField(default=False)
    created_at        = models.DateTimeField(auto_now_add=True)

    # Optional link data
    related_id        = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        db_table = 'notification'
        ordering = ['-created_at']

    def __str__(self):
        return f'[{self.notification_type}] → {self.recipient.username}: {self.title}'