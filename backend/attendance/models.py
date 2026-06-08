"""
attendance/models.py — AMECO Attendance & Overstay Tracking
============================================================

AttendanceRecord
    One record per person per session (ENTRY → EXIT pair).
    When a person is scanned for the first time that session an ENTRY record
    is created with exit_time=None.  The next scan closes the record by setting
    exit_time and computing duration_minutes.

    Person identity is stored as:
      • person_type  — STAFF | ADMIN | GUARD | VISITOR
      • digital_id   — unique identifier copied from their profile
      • person_name  — denormalised for fast reads / permanent history

OverstayAlert
    Created automatically when a visitor's in-premises duration exceeds their
    allowed_minutes.  Also created for staff/admin who stay past closing time
    (optional — controlled by OVERSTAY_STAFF_HOURS setting).
    Once a security guard acknowledges the alert, resolved=True is set.
"""

from django.db import models
from django.utils import timezone


class AttendanceRecord(models.Model):
    PERSON_TYPE_CHOICES = [
        ('STAFF',   'Staff'),
        ('ADMIN',   'Admin'),
        ('GUARD',   'Guard'),
        ('VISITOR', 'Visitor'),
    ]
    STATUS_CHOICES = [
        ('INSIDE',     'Inside'),       # entry recorded, still on premises
        ('EXITED',     'Exited'),       # exit recorded normally
        ('OVERSTAY',   'Overstay'),     # visitor exceeded allowed time
        ('UNRESOLVED', 'Unresolved'),   # entry without exit (e.g. system restart)
    ]

    # ── Person identity ───────────────────────────────────────────────────────
    person_type     = models.CharField(max_length=10, choices=PERSON_TYPE_CHOICES)
    digital_id      = models.CharField(max_length=50, db_index=True)
    person_name     = models.CharField(max_length=255)
    person_role     = models.CharField(max_length=50, blank=True)   # display_role string
    profile_image   = models.CharField(max_length=512, blank=True)  # relative URL

    # ── Timing ────────────────────────────────────────────────────────────────
    entry_time      = models.DateTimeField(default=timezone.now)
    exit_time       = models.DateTimeField(null=True, blank=True)
    duration_minutes= models.IntegerField(null=True, blank=True)    # filled on exit

    # For visitors: how long they are allowed to stay (minutes)
    allowed_minutes = models.IntegerField(null=True, blank=True)

    # ── Context ───────────────────────────────────────────────────────────────
    gate_camera_id  = models.CharField(max_length=50, blank=True)
    entry_confidence= models.FloatField(null=True, blank=True)
    exit_confidence = models.FloatField(null=True, blank=True)
    status          = models.CharField(max_length=15, choices=STATUS_CHOICES, default='INSIDE')

    # Ethiopian time strings (pre-formatted, no conversion needed on frontend)
    entry_eth_time  = models.CharField(max_length=60, blank=True)
    exit_eth_time   = models.CharField(max_length=60, blank=True)

    class Meta:
        db_table = 'attendance_record'
        ordering = ['-entry_time']
        indexes  = [
            models.Index(fields=['digital_id', 'entry_time']),
            models.Index(fields=['status']),
            models.Index(fields=['person_type', 'entry_time']),
        ]

    def __str__(self):
        return (
            f'{self.person_name} ({self.digital_id}) '
            f'IN:{self.entry_time:%Y-%m-%d %H:%M} '
            f'STATUS:{self.status}'
        )

    @property
    def is_open(self):
        """True if the person is still inside (no exit recorded yet)."""
        return self.exit_time is None

    @property
    def current_duration_minutes(self):
        """Duration so far — uses now() if still inside."""
        base = self.exit_time or timezone.now()
        return int((base - self.entry_time).total_seconds() / 60)

    def close(self, exit_time=None, exit_confidence=None, gate=None):
        """Record exit. Computes duration. Marks EXITED or OVERSTAY."""
        self.exit_time       = exit_time or timezone.now()
        self.duration_minutes= int((self.exit_time - self.entry_time).total_seconds() / 60)
        self.exit_eth_time   = _eth_time_str(self.exit_time)
        if exit_confidence is not None:
            self.exit_confidence = exit_confidence
        if gate:
            self.gate_camera_id = gate

        if self.person_type == 'VISITOR' and self.allowed_minutes:
            self.status = 'OVERSTAY' if self.duration_minutes > self.allowed_minutes else 'EXITED'
        else:
            self.status = 'EXITED'
        self.save()
        return self


class OverstayAlert(models.Model):
    SEVERITY_CHOICES = [
        ('WARNING',  'Warning'),   # approaching limit (>80% of allowed time)
        ('CRITICAL', 'Critical'),  # exceeded allowed time
    ]

    record      = models.ForeignKey(
        AttendanceRecord, on_delete=models.CASCADE, related_name='alerts'
    )
    digital_id  = models.CharField(max_length=50)
    person_name = models.CharField(max_length=255)
    person_type = models.CharField(max_length=10)
    gate_camera_id = models.CharField(max_length=50, blank=True)

    severity        = models.CharField(max_length=10, choices=SEVERITY_CHOICES, default='CRITICAL')
    minutes_over    = models.IntegerField(default=0)   # how many min past allowed
    allowed_minutes = models.IntegerField(default=0)
    duration_minutes= models.IntegerField(default=0)   # total time inside when alert fired

    alerted_at  = models.DateTimeField(auto_now_add=True)
    resolved    = models.BooleanField(default=False)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.CharField(max_length=150, blank=True)
    notes       = models.TextField(blank=True)

    class Meta:
        db_table = 'overstay_alert'
        ordering = ['-alerted_at']

    def __str__(self):
        return f'[{self.severity}] {self.person_name} +{self.minutes_over}min @ {self.alerted_at:%H:%M}'

    def resolve(self, by='', notes=''):
        self.resolved    = True
        self.resolved_at = timezone.now()
        self.resolved_by = by
        self.notes       = notes
        self.save()


def _eth_time_str(dt=None):
    """Return a human-readable Ethiopian-time string for the given datetime."""
    from datetime import timezone as tz, timedelta
    if dt is None:
        dt = timezone.now()
    eat = dt.astimezone(tz(timedelta(hours=3)))
    return eat.strftime('%d/%m/%Y %H:%M ET')
