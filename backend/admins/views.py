"""
admins/views.py
AMECO — AdminProfile CRUD.

Access rules:
  • list / retrieve  — IsSuperAdmin  OR  CanManageAdmins
  • create           — IsSuperAdmin only (only super admin can create other admins)
  • update (patch)   — IsSuperAdmin  OR  CanManageAdmins
      – Non-super admins cannot touch `is_super_admin` or `privileges` fields
  • destroy          — IsSuperAdmin only

Security:
  • Privilege escalation blocked: a non-super admin cannot promote someone to
    super admin or grant them a privilege they don't have themselves.
  • A super admin cannot delete themselves.
"""

from rest_framework import viewsets, status
from rest_framework.permissions import BasePermission
from rest_framework.response import Response

from authentication.permissions import IsSuperAdmin, CanManageAdmins
from .models import AdminProfile
from .serializers import AdminProfileSerializer


# ── Combined permission: super admin OR manage_admins privilege ───────────────

class _IsSuperAdminOrCanManageAdmins(BasePermission):
    """
    Grants access if the requesting user is a super admin OR holds the
    'manage_admins' privilege.  Written as a single class to avoid DRF
    version issues with the `|` operator between permission instances.

    Also accepts Django superusers (is_superuser=True) who may not have an
    AdminProfile yet — they are treated as super admins.
    """
    message = 'Super Admin access or "Manage Admins" privilege required.'

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False

        # Django superusers always pass (e.g. created via createsuperuser
        # before an AdminProfile has been attached to them).
        if user.is_superuser:
            return True

        # Must be an admin role
        if user.role != 'admin':
            return False

        try:
            profile = user.adminprofile
        except Exception:
            return False

        # Super admins pass unconditionally
        if profile.is_super_admin:
            return True

        # Regular admins need the manage_admins privilege
        return profile.has_privilege('manage_admins')


class _IsSuperAdmin(BasePermission):
    """
    Grants access only to super admins.  Django superusers (is_superuser=True)
    without an AdminProfile are also accepted so the dashboard works right
    after `createsuperuser`.
    """
    message = 'Super Admin access required.'

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False

        if user.is_superuser:
            return True

        if user.role != 'admin':
            return False

        try:
            profile = user.adminprofile
            return profile.is_super_admin
        except Exception:
            return False


# ── ViewSet ───────────────────────────────────────────────────────────────────

class AdminProfileViewSet(viewsets.ModelViewSet):
    queryset         = AdminProfile.objects.all().order_by('-registered_at')
    serializer_class = AdminProfileSerializer

    # ── Permission routing ────────────────────────────────────────────────────

    def get_permissions(self):
        """
        create / destroy → super admin only
        list / retrieve / update / partial_update → super admin OR manage_admins
        """
        if self.action in ('create', 'destroy'):
            return [_IsSuperAdmin()]
        return [_IsSuperAdminOrCanManageAdmins()]

    # ── Create ────────────────────────────────────────────────────────────────

    def perform_create(self, serializer):
        serializer.save(registered_by=self.request.user.username)

    # ── Update — privilege escalation guard ───────────────────────────────────

    def update(self, request, *args, **kwargs):
        user = request.user
        is_requester_super = user.is_superuser

        if not is_requester_super:
            try:
                profile = user.adminprofile
                is_requester_super = profile.is_super_admin
            except Exception:
                is_requester_super = False

        # Non-super admins cannot modify is_super_admin or privileges fields
        if not is_requester_super:
            mutable = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
            mutable.pop('is_super_admin', None)
            mutable.pop('privileges',     None)
            request._full_data = mutable

        return super().update(request, *args, **kwargs)

    # ── Destroy — prevent self-deletion ───────────────────────────────────────

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.user == request.user:
            return Response(
                {'detail': 'You cannot delete your own admin account.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)
