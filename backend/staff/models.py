"""
staff/models.py
AMECO — StaffProfile model.
"""

from django.db import models


class StaffProfile(models.Model):
    GENDER_CHOICES = [('M', 'Male'), ('F', 'Female'), ('O', 'Other')]

    profile_image  = models.ImageField(upload_to='staff/profiles/', null=True, blank=True)
    first_name     = models.CharField(max_length=100)
    middle_name    = models.CharField(max_length=100, blank=True)
    last_name      = models.CharField(max_length=100, blank=True)
    phone_number   = models.CharField(max_length=30, blank=True)
    email          = models.EmailField(blank=True)
    gender         = models.CharField(max_length=1, choices=GENDER_CHOICES, default='M')
    position       = models.CharField(max_length=150, blank=True)
    department     = models.CharField(max_length=150, blank=True)
    description    = models.TextField(blank=True)
    staff_tag      = models.CharField(max_length=100, blank=True)
    digital_id     = models.CharField(max_length=50, unique=True, blank=True)
    id_card_image  = models.ImageField(upload_to='staff/id_cards/', null=True, blank=True)
    gate_registered_on = models.CharField(max_length=50, blank=True)
    registered_by  = models.CharField(max_length=255, blank=True)
    registered_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'staff_profile'

    def __str__(self):
        return f'{self.first_name} {self.last_name} ({self.position})'

    def full_name(self):
        return f'{self.first_name} {self.middle_name} {self.last_name}'.strip()

    def delete(self, *args, **kwargs):
        from recognition.models import BiometricData
        from django.contrib.contenttypes.models import ContentType

        content_type = ContentType.objects.get_for_model(self)
        BiometricData.objects.filter(content_type=content_type, object_id=self.id).delete()
        super().delete(*args, **kwargs)

        # Refresh recognition cache so deleted staff are not recognized
        try:
            from recognition.encoding import load_all_encodings
            load_all_encodings()
        except Exception:
            pass