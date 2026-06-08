"""
recognition/models.py
AMECO — BiometricData model using GenericForeignKey so it can link to
AdminProfile, GuardProfile, StaffProfile, or Visitor with one model.
"""

from django.db import models
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType


class BiometricData(models.Model):
    # Generic FK — links to any registered person model
    content_type   = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id      = models.PositiveIntegerField()
    content_object = GenericForeignKey('content_type', 'object_id')

    # Five face angle images
    face_front    = models.ImageField(upload_to='biometrics/faces/', null=True, blank=True)
    face_left     = models.ImageField(upload_to='biometrics/faces/', null=True, blank=True)
    face_right    = models.ImageField(upload_to='biometrics/faces/', null=True, blank=True)
    face_down     = models.ImageField(upload_to='biometrics/faces/', null=True, blank=True)
    face_unusual  = models.ImageField(upload_to='biometrics/faces/', null=True, blank=True)

    # ID card scans
    id_card_front = models.ImageField(upload_to='biometrics/ids/', null=True, blank=True)
    id_card_back  = models.ImageField(upload_to='biometrics/ids/', null=True, blank=True)

    # Computed 128-dim face encoding vectors (list of lists)
    face_encodings = models.JSONField(default=list)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'recognition_biometric'
        indexes = [
            models.Index(fields=['content_type', 'object_id']),
        ]

    def __str__(self):
        return f'BiometricData for {self.content_type} #{self.object_id}'