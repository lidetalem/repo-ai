"""
authentication/views.py
AMECO — Login view with login-scoped throttle (10 attempts/minute per IP).
Replaces the previous LoginView.  All other views unchanged.
"""

from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.throttling import AnonRateThrottle
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

from .serializers import LoginSerializer
from logs.utils import create_log


# ── Custom throttle — 10 login attempts per minute per IP ─────────────────────
class LoginRateThrottle(AnonRateThrottle):
    scope = 'login'


# ── Helper: build admin extras ────────────────────────────────────────────────
def _build_admin_extras(user, request):
    full_name         = user.display_name
    profile_image_url = None
    privileges        = []
    is_super_admin    = False

    try:
        p = user.adminprofile
        full_name         = f'{p.first_name} {p.middle_name} {p.last_name}'.strip()
        profile_image_url = request.build_absolute_uri(p.profile_image.url) if p.profile_image else None
        privileges        = list(p.privileges or [])
        is_super_admin    = bool(p.is_super_admin)
    except Exception:
        pass

    return full_name, profile_image_url, privileges, is_super_admin


def _build_guard_extras(user, request):
    full_name         = user.display_name
    profile_image_url = None

    try:
        p = user.guardprofile
        full_name         = f'{p.first_name} {p.middle_name} {p.last_name}'.strip()
        profile_image_url = request.build_absolute_uri(p.profile_image.url) if p.profile_image else None
    except Exception:
        pass

    return full_name, profile_image_url


# ── Views ─────────────────────────────────────────────────────────────────────

class LoginView(APIView):
    permission_classes = [AllowAny]
    # Throttle: max 10 login attempts per minute from any single IP
    throttle_classes   = [LoginRateThrottle]

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user    = serializer.validated_data['user']
        refresh = RefreshToken.for_user(user)
        access  = refresh.access_token

        privileges     = []
        is_super_admin = False

        if user.role == 'admin':
            full_name, profile_image_url, privileges, is_super_admin = _build_admin_extras(user, request)
        else:
            full_name, profile_image_url = _build_guard_extras(user, request)

        create_log(
            actor=user,
            action_type='LOGIN',
            description=f'{user.username} logged in from {_get_client_ip(request)}.',
        )

        return Response({
            'access':            str(access),
            'refresh':           str(refresh),
            'role':              user.role,
            'user_id':           user.id,
            'username':          user.username,
            'full_name':         full_name,
            'profile_image_url': profile_image_url,
            'privileges':        privileges,
            'is_super_admin':    is_super_admin,
        }, status=status.HTTP_200_OK)


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get('refresh')
        if not refresh_token:
            return Response({'detail': 'Refresh token required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except TokenError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        create_log(
            actor=request.user,
            action_type='LOGOUT',
            description=f'{request.user.username} logged out.',
        )

        return Response({'detail': 'Logged out successfully.'}, status=status.HTTP_200_OK)


class MeView(APIView):
    """Return the current user's profile including up-to-date privileges."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user           = request.user
        privileges     = []
        is_super_admin = False

        if user.role == 'admin':
            full_name, profile_image_url, privileges, is_super_admin = _build_admin_extras(user, request)
        else:
            full_name, profile_image_url = _build_guard_extras(user, request)

        return Response({
            'user_id':           user.id,
            'username':          user.username,
            'role':              user.role,
            'full_name':         full_name,
            'profile_image_url': profile_image_url,
            'privileges':        privileges,
            'is_super_admin':    is_super_admin,
        })


# ── Utility ───────────────────────────────────────────────────────────────────

def _get_client_ip(request):
    x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded:
        return x_forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', 'unknown')