"""
logs/serializers.py
"""
from rest_framework import serializers
from .models import AccessLog


class AccessLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AccessLog
        fields = '__all__'