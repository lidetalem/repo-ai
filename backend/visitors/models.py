"""
visitors/models.py
AMECO — Visitor and VisitorRequest models.
"""

from django.db import models


class Visitor(models.Model):
    GENDER_CHOICES = [('M', 'Male'), ('F', 'Female'), ('O', 'Other')]

    profile_image       = models.ImageField(upload_to='visitors/profiles/', null=True, blank=True)
    first_name          = models.CharField(max_length=100)
    middle_name         = models.CharField(max_length=100, blank=True)
    last_name           = models.CharField(max_length=100, blank=True)
    phone               = models.CharField(max_length=30, blank=True)
    email               = models.EmailField(blank=True)
    gender              = models.CharField(max_length=1, choices=GENDER_CHOICES, default='M')
    date_of_first_entry = models.DateField(null=True, blank=True)
    date_of_expiry      = models.DateField(null=True, blank=True)
    description         = models.TextField(blank=True)   # reason for visit
    visitor_tag         = models.CharField(max_length=100, blank=True)
    digital_id          = models.CharField(max_length=50, unique=True, blank=True)
    id_card_image       = models.ImageField(upload_to='visitors/id_cards/', null=True, blank=True)
    gate_registered_on  = models.CharField(max_length=50, blank=True)
    registered_by       = models.CharField(max_length=255, blank=True)
    registered_at       = models.DateTimeField(auto_now_add=True)

    # Legacy fields used by existing frontend
    reason              = models.TextField(blank=True)
    start_date          = models.DateField(null=True, blank=True)
    end_date            = models.DateField(null=True, blank=True)

    class Meta:
        db_table = 'visitor_profile'
        ordering = ['-registered_at']

    def __str__(self):
        return f'{self.first_name} {self.last_name} (Visitor)'

    def full_name(self):
        return f'{self.first_name} {self.middle_name} {self.last_name}'.strip()

    def delete(self, *args, **kwargs):
        from recognition.models import BiometricData
        from django.contrib.contenttypes.models import ContentType

        content_type = ContentType.objects.get_for_model(self)
        BiometricData.objects.filter(content_type=content_type, object_id=self.id).delete()
        super().delete(*args, **kwargs)

        # Refresh recognition cache so deleted visitors are not recognized
        try:
            from recognition.encoding import load_all_encodings
            load_all_encodings()
        except Exception:
            pass


class VisitorRequest(models.Model):
    STATUS_CHOICES = [
        ('PENDING',  'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
    ]

    temp_user       = models.ForeignKey(Visitor, on_delete=models.CASCADE, related_name='requests', null=True, blank=True)
    guard_username  = models.CharField(max_length=150, blank=True)
    status          = models.CharField(max_length=10, choices=STATUS_CHOICES, default='PENDING')
    reason          = models.TextField(blank=True)
    start_date      = models.DateField(null=True, blank=True)
    end_date        = models.DateField(null=True, blank=True)
    denial_reason   = models.TextField(blank=True)
    seen_by_guard   = models.BooleanField(default=False)
    submitted_at    = models.DateTimeField(auto_now_add=True)
    responded_at    = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'visitor_request'
        ordering = ['-submitted_at']

    def __str__(self):
        return f'Request #{self.id} — {self.temp_user} [{self.status}]'