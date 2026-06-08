"""
authentication/serializers.py
AMECO — Login serializer and token response.
"""

from rest_framework import serializers
from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken

from .models import CustomUser


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(required=True)
    password = serializers.CharField(required=True, write_only=True)

    def validate(self, data):
        login_key = data.get('username', '').strip()
        password = data.get('password', '')

        if not login_key or not password:
            raise serializers.ValidationError('Username and password are required.')

        user = authenticate(username=login_key, password=password)
        if not user and '@' in login_key:
            try:
                user_obj = CustomUser.objects.get(email__iexact=login_key)
                user = authenticate(username=user_obj.username, password=password)
            except CustomUser.DoesNotExist:
                user = None

        if not user:
            raise serializers.ValidationError('Invalid credentials.')
        if not user.is_active:
            raise serializers.ValidationError('Account is disabled.')

        data['user'] = user
        return data