"""
cameras/models.py
AMECO — GateWithCamera model for physical camera/gate units.
"""

from django.db import models


class GateWithCamera(models.Model):
    POWER_CHOICES = [('on', 'On'), ('off', 'Off')]
    STATUS_CHOICES = [('active', 'Active'), ('maintenance', 'On Maintenance')]

    gate_name        = models.CharField(max_length=100)
    camera_name      = models.CharField(max_length=100)
    terminal_id      = models.CharField(max_length=50, unique=True)  # GateWithCameraID
    power            = models.CharField(max_length=5, choices=POWER_CHOICES, default='on')
    status           = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    installation_date = models.DateField(null=True, blank=True)
    location         = models.TextField(blank=True)
    ip_address       = models.CharField(max_length=50, blank=True)
    mac_address      = models.CharField(max_length=50, blank=True)
    name             = models.CharField(max_length=100, blank=True)  # display name alias
    created_at       = models.DateTimeField(auto_now_add=True, null=True)

    class Meta:
        db_table = 'cameras_gate'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.gate_name} — {self.terminal_id} ({self.power}/{self.status})'