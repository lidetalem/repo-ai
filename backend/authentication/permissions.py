"""
authentication/permissions.py
AMECO — Role-based and privilege-based permission classes.

Privilege keys (must match frontend PrivilegesSection.jsx):
  manage_staff    — Add, edit & remove staff
  manage_guards   — Full guard account control
  manage_visitors — Visitor authorization & records
  manage_cameras  — Add, power & configure cameras
  view_logs       — Full system activity logs
  review_requests — Approve or deny access requests
  manage_settings — Modify platform configuration
  manage_admins   — Register & configure admins (view-only for non-super)
  view_reports    — Analytics & reporting data

Hierarchy:
  SuperAdmin  → all access, no checks
  Admin       → only their assigned privileges
  Guard       → role-restricted to guard-specific endpoints
"""

from rest_framework.permissions import BasePermission

# ── Canonical privilege key list ─────────────────────────────────────────────
ALL_PRIVILEGES = [
    'manage_staff',
    'manage_guards',
    'manage_visitors',
    'manage_cameras',
    'view_logs',
    'review_requests',
    'manage_settings',
    'manage_admins',
    'view_reports',
]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_admin_profile(user):
    """Returns the AdminProfile for user, or None."""
    try:
        if user and user.is_authenticated and user.role == 'admin':
            return user.adminprofile
    except Exception:
        pass
    return None


# ── Basic role permissions ────────────────────────────────────────────────────

class IsAdmin(BasePermission):
    """Grants access only to users with role='admin'."""
    message = 'Admin access required.'

    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated
            and request.user.role == 'admin'
        )


class IsGuard(BasePermission):
    """Grants access only to users with role='guard'."""
    message = 'Guard access required.'

    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated
            and request.user.role == 'guard'
        )


class IsAdminOrGuard(BasePermission):
    """Grants access to both admins and guards."""
    message = 'Authentication required.'

    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated
            and request.user.role in ('admin', 'guard')
        )


# ── Super Admin permission ────────────────────────────────────────────────────

class IsSuperAdmin(BasePermission):
    """
    Grants access ONLY to admins with is_super_admin=True.
    Used for: creating/deleting other admins, assigning manage_admins privilege.
    """
    message = 'Super Admin access required.'

    def has_permission(self, request, view):
        profile = _get_admin_profile(request.user)
        return bool(profile and profile.is_super_admin)


# ── Privilege-based permissions ───────────────────────────────────────────────

class HasPrivilege(BasePermission):
    """
    Base privilege permission.
    Super admins always pass.
    Regular admins must have `self.privilege` in their privileges list.

    Usage — subclass or use the factory:
        permission_classes = [privilege_required('manage_staff')]
    """
    privilege = None
    message   = 'You do not have permission to perform this action.'

    def has_permission(self, request, view):
        profile = _get_admin_profile(request.user)
        if not profile:
            return False
        return profile.has_privilege(self.privilege)


def privilege_required(key):
    """
    Factory: returns a DRF permission class requiring `key` privilege.

    Example:
        class MyView(APIView):
            permission_classes = [privilege_required('manage_cameras')]
    """
    return type(
        f'Priv_{key}',
        (HasPrivilege,),
        {
            'privilege': key,
            'message': f'Access denied — "{key.replace("_", " ").title()}" privilege required.',
        },
    )


# ── Named privilege aliases (import-friendly) ─────────────────────────────────

CanManageStaff    = privilege_required('manage_staff')
CanManageGuards   = privilege_required('manage_guards')
CanManageVisitors = privilege_required('manage_visitors')
CanManageCameras  = privilege_required('manage_cameras')
CanViewLogs       = privilege_required('view_logs')
CanReviewRequests = privilege_required('review_requests')
CanManageSettings = privilege_required('manage_settings')
CanManageAdmins   = privilege_required('manage_admins')
CanViewReports    = privilege_required('view_reports')


# ── Mixed: Guard always passes, admin needs privilege ─────────────────────────

class _GuardOrPrivilege(BasePermission):
    """
    Guards always pass (they legitimately access this endpoint by role).
    Admins must hold the specified privilege OR be super admin.
    """
    privilege = None
    message   = 'Access denied — insufficient privileges.'

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if user.role == 'guard':
            return True
        profile = _get_admin_profile(user)
        return bool(profile and profile.has_privilege(self.privilege))


def guard_or_privilege(key):
    """
    Factory for mixed guard+admin-privilege permission.

    Example:
        # Visitors endpoint — guards register, admins need manage_visitors
        permission_classes = [guard_or_privilege('manage_visitors')]
    """
    return type(
        f'GuardOrPriv_{key}',
        (_GuardOrPrivilege,),
        {
            'privilege': key,
            'message': f'Access denied — "{key.replace("_", " ").title()}" privilege required.',
        },
    )