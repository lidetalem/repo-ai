from rest_framework import viewsets
from authentication.permissions import CanManageStaff
from .models import StaffProfile
from .serializers import StaffProfileSerializer


class StaffProfileViewSet(viewsets.ModelViewSet):
    queryset         = StaffProfile.objects.all().order_by('-registered_at')
    serializer_class = StaffProfileSerializer
    permission_classes = [CanManageStaff]