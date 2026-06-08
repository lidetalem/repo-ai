"""
authentication/models.py
AMECO — Custom User Model extending AbstractUser.
Roles: admin, guard

CustomUserManager overrides create_superuser so that running
`python manage.py createsuperuser` always produces an admin (not a guard)
and automatically creates a matching AdminProfile with is_super_admin=True.
"""

import uuid
from django.contrib.auth.models import AbstractUser, UserManager
from django.db import models


class CustomUserManager(UserManager):
    """
    Extends Django's default UserManager to ensure superusers are created
    with role='admin' and get an AdminProfile with is_super_admin=True.
    """

    def create_superuser(self, username, email=None, password=None, **extra_fields):
        # Force admin role — never let the default 'guard' slip through
        extra_fields['role'] = 'admin'
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)

        user = super().create_superuser(username, email, password, **extra_fields)

        # Auto-create the AdminProfile so the dashboard works immediately
        self._create_admin_profile(user)

        return user

    @staticmethod
    def _create_admin_profile(user):
        """
        Creates an AdminProfile linked to the given user if one doesn't
        already exist. Marks it as super admin with all privileges.
        """
        # Import here to avoid circular imports at module load time
        from admins.models import AdminProfile
        from authentication.permissions import ALL_PRIVILEGES

        if not AdminProfile.objects.filter(user=user).exists():
            AdminProfile.objects.create(
                user=user,
                first_name=user.first_name or user.username,
                middle_name='',
                last_name=user.last_name or '',
                digital_id=f'ADM-{uuid.uuid4().hex[:8].upper()}',
                registered_by='system',
                is_super_admin=True,
                privileges=list(ALL_PRIVILEGES),
            )


class CustomUser(AbstractUser):
    ROLE_CHOICES = [
        ('admin', 'Admin'),
        ('guard', 'Guard'),
    ]

    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='guard')
    full_name = models.CharField(max_length=255, blank=True)
    profile_image = models.ImageField(upload_to='profiles/', null=True, blank=True)

    objects = CustomUserManager()

    class Meta:
        db_table = 'auth_custom_user'
        verbose_name = 'User'
        verbose_name_plural = 'Users'

    def __str__(self):
        return f'{self.username} ({self.role})'

    @property
    def display_name(self):
        return self.full_name or self.get_full_name() or self.username
