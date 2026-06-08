# backend/cameras/serializers.py
"""
GateWithCamera serializer.

views.py imports GateWithCameraSerializer from here.
If this file was missing, every API request to /api/camera/terminals/
would crash with ImportError — making ALL buttons fail silently
(the browser catches a 500 and the catch() block fires toast.error).
"""

from rest_framework import serializers
from .models import GateWithCamera


class GateWithCameraSerializer(serializers.ModelSerializer):
    # Computed display fields (read-only, useful for the frontend cards)
    is_live        = serializers.SerializerMethodField()
    status_display = serializers.SerializerMethodField()
    power_display  = serializers.SerializerMethodField()

    class Meta:
        model  = GateWithCamera
        fields = [
            'id',
            'gate_name',
            'camera_name',
            'terminal_id',
            'power',
            'status',
            'installation_date',
            'location',
            'ip_address',
            'mac_address',
            'name',
            'created_at',
            # computed
            'is_live',
            'status_display',
            'power_display',
        ]
        read_only_fields = ['id', 'created_at', 'is_live', 'status_display', 'power_display']

    def get_is_live(self, obj) -> bool:
        return obj.power == 'on' and obj.status == 'active'

    def get_status_display(self, obj) -> str:
        return dict(GateWithCamera.STATUS_CHOICES).get(obj.status, obj.status)

    def get_power_display(self, obj) -> str:
        return 'ON' if obj.power == 'on' else 'OFF'
