"""
logs/models.py
AMECO — System-wide audit log.
"""

from django.db import models
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType


class AccessLog(models.Model):
    ACTION_CHOICES = [
        ('LOGIN',           'Login'),
        ('LOGOUT',          'Logout'),
        ('SCAN_ACCEPTED',   'Scan Accepted'),
        ('SCAN_REJECTED',   'Scan Rejected'),
        ('SPOOF_DETECTED',  'Spoof Detected'),
        ('ATTEMPT_LIMIT',   'Attempt Limit Reached'),
        ('REGISTER',        'User Registered'),
        ('EDIT',            'User Edited'),
        ('DELETE',          'User Deleted'),
        ('REQUEST_SUBMIT',  'Request Submitted'),
        ('REQUEST_APPROVE', 'Request Approved'),
        ('REQUEST_DENY',    'Request Denied'),
        ('CAMERA_ADD',      'Camera Added'),
        ('CAMERA_EDIT',     'Camera Edited'),
        ('CAMERA_POWER',    'Camera Power Toggle'),
        ('SYSTEM',          'System Event'),
    ]

    # Who performed the action (nullable for system events)
    actor_content_type = models.ForeignKey(
        ContentType, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='log_actor'
    )
    actor_object_id    = models.PositiveIntegerField(null=True, blank=True)
    actor              = GenericForeignKey('actor_content_type', 'actor_object_id')

    # Denormalised actor info (fast read, no joins)
    actor_username     = models.CharField(max_length=150, blank=True)
    actor_role         = models.CharField(max_length=20, blank=True)
    actor_name         = models.CharField(max_length=255, blank=True)
    actor_image        = models.CharField(max_length=512, blank=True)

    action_type        = models.CharField(max_length=30, choices=ACTION_CHOICES)
    description        = models.TextField(blank=True)
    gate_camera_id     = models.CharField(max_length=50, blank=True)
    ethiopian_time     = models.CharField(max_length=50, blank=True)  # pre-formatted ET string
    timestamp          = models.DateTimeField(auto_now_add=True)

    # Scan-specific extra fields
    confidence         = models.FloatField(null=True, blank=True)
    scan_result        = models.CharField(max_length=30, blank=True)

    class Meta:
        db_table = 'access_log'
        ordering = ['-timestamp']

    def __str__(self):
        return f'[{self.action_type}] {self.actor_username} @ {self.timestamp}'