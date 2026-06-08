from rest_framework import viewsets
from authentication.permissions import IsAdminOrGuard, CanManageGuards
from guards.models import GuardProfile
from guards.serializers import GuardProfileSerializer


class GuardProfileViewSet(viewsets.ModelViewSet):
    queryset         = GuardProfile.objects.all().order_by('-registered_at')
    serializer_class = GuardProfileSerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAdminOrGuard()]
        return [CanManageGuards()]

