from rest_framework import serializers
from .models import AttendanceRecord, OverstayAlert


class AttendanceRecordSerializer(serializers.ModelSerializer):
    current_duration_minutes = serializers.SerializerMethodField()
    is_open                  = serializers.BooleanField(read_only=True)

    class Meta:
        model  = AttendanceRecord
        fields = '__all__'

    def get_current_duration_minutes(self, obj):
        return obj.current_duration_minutes


class OverstayAlertSerializer(serializers.ModelSerializer):
    class Meta:
        model  = OverstayAlert
        fields = '__all__'
