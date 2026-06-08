"""
admins/models.py
AMECO — AdminProfile model with privilege-based access control.

An admin is typically an existing staff member (e.g. HR, IT manager) who
has been granted system privileges.  The optional `linked_staff` field
records that relationship so the face-recognition pipeline can return the
correct identity (Admin, not Staff) when this person walks through a camera.
"""

from django.db import models
from authentication.models import CustomUser


class AdminProfile(models.Model):
    GENDER_CHOICES = [('M', 'Male'), ('F', 'Female'), ('O', 'Other')]

    user           = models.OneToOneField(CustomUser, on_delete=models.CASCADE, related_name='adminprofile', null=True, blank=True)
    profile_image  = models.ImageField(upload_to='admins/profiles/', null=True, blank=True)
    first_name     = models.CharField(max_length=100)
    middle_name    = models.CharField(max_length=100, blank=True)
    last_name      = models.CharField(max_length=100, blank=True)
    phone_number   = models.CharField(max_length=30, blank=True)
    gender         = models.CharField(max_length=1, choices=GENDER_CHOICES, default='M')
    description    = models.TextField(blank=True)
    admin_tag      = models.CharField(max_length=100, blank=True)
    digital_id     = models.CharField(max_length=50, unique=True, blank=True)
    id_card_image  = models.ImageField(upload_to='admins/id_cards/', null=True, blank=True)
    gate_registered_on = models.CharField(max_length=50, blank=True)
    gates_assigned_to  = models.CharField(max_length=255, blank=True)
    registered_by  = models.CharField(max_length=255, blank=True)
    registered_at  = models.DateTimeField(auto_now_add=True)

    # ── Staff link ───────────────────────────────────────────────────────────
    # If this admin is also registered as a staff member, link to their
    # StaffProfile here.  The recognition pipeline uses this to display
    # "Admin" (not "Staff") when the person enters through a camera.
    linked_staff = models.OneToOneField(
        'staff.StaffProfile',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='admin_override',
        help_text='If this admin is also a staff member, link their StaffProfile here so face recognition shows the Admin identity.',
    )

    # ── Privilege-based access control ───────────────────────────────────────
    is_super_admin = models.BooleanField(default=False)
    privileges = models.JSONField(default=list, blank=True)

    class Meta:
        db_table = 'admin_profile'

    def __str__(self):
        tag = 'Super Admin' if self.is_super_admin else 'Admin'
        return f'{self.first_name} {self.last_name} ({tag})'

    def full_name(self):
        return f'{self.first_name} {self.middle_name} {self.last_name}'.strip()

    def has_privilege(self, key):
        """Returns True if this admin has the given privilege OR is a super admin."""
        if self.is_super_admin:
            return True
        return key in (self.privileges or [])

    def delete(self, *args, **kwargs):
        from authentication.models import CustomUser
        from recognition.models import BiometricData
        from django.contrib.contenttypes.models import ContentType

        user_id = self.user_id
        content_type = ContentType.objects.get_for_model(self)
        BiometricData.objects.filter(content_type=content_type, object_id=self.id).delete()
        super().delete(*args, **kwargs)
        if user_id:
            CustomUser.objects.filter(pk=user_id).delete()

        try:
            from recognition.encoding import load_all_encodings
            load_all_encodings()
        except Exception:
            pass
