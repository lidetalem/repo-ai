"""
admins/serializers.py
AMECO — AdminProfile serializer with privilege support.
"""
import uuid
import json
from rest_framework import serializers
from authentication.models import CustomUser
from authentication.permissions import ALL_PRIVILEGES
from .models import AdminProfile


class AdminProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    email    = serializers.EmailField(required=False, allow_blank=True)
    tag          = serializers.CharField(write_only=True, required=False)
    linked_staff = serializers.PrimaryKeyRelatedField(
        queryset=__import__('staff.models', fromlist=['StaffProfile']).StaffProfile.objects.all(),
        required=False, allow_null=True,
        help_text='Link to a StaffProfile so this admin is recognised as Admin at cameras.',
    )

    # Biometric base64 fields (write-only)
    profile_image_base64 = serializers.CharField(write_only=True, required=False, allow_blank=True)
    face_scan_1_base64   = serializers.CharField(write_only=True, required=False, allow_blank=True)
    face_scan_2_base64   = serializers.CharField(write_only=True, required=False, allow_blank=True)
    face_scan_3_base64   = serializers.CharField(write_only=True, required=False, allow_blank=True)
    face_scan_4_base64   = serializers.CharField(write_only=True, required=False, allow_blank=True)
    face_scan_5_base64   = serializers.CharField(write_only=True, required=False, allow_blank=True)
    id_card_front_base64 = serializers.CharField(write_only=True, required=False, allow_blank=True)
    id_card_back_base64  = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model  = AdminProfile
        fields = '__all__'
        read_only_fields = ('digital_id', 'registered_at', 'user')

    # ── Validation ────────────────────────────────────────────────────────────

    def to_internal_value(self, data):
        """
        When the request is multipart/form-data, DRF's JSONField receives
        `privileges` as a raw Python string (e.g. '["manage_staff","view_logs"]')
        because FormData can only carry strings.  DRF's default JSONField
        behaviour is to call json.dumps() on the string to check it's
        serialisable — which succeeds and returns the *string* unchanged,
        so validate_privileges then sees a str instead of a list and silently
        discards everything.

        We intercept the data dict here, before field-level validation,
        and parse `privileges` from JSON string → Python list when needed.
        """
        if hasattr(data, '_mutable'):
            # QueryDict — make a plain dict copy so we can mutate it
            data = data.dict()
            # QueryDict.dict() collapses multi-value keys to the last value.
            # Re-read privileges via getlist so repeated-key submissions also work.
        
        # Normalise privileges to a list before DRF sees it
        raw_privs = data.get('privileges', None)
        if isinstance(raw_privs, str):
            try:
                parsed = json.loads(raw_privs)
                if isinstance(parsed, list):
                    data['privileges'] = parsed
                else:
                    data['privileges'] = []
            except (ValueError, TypeError):
                data['privileges'] = []
        elif raw_privs is None:
            # Not sent at all — default to empty list to avoid JSONField error
            data['privileges'] = []

        return super().to_internal_value(data)

    def validate_privileges(self, value):
        """Strip any unrecognised privilege keys."""
        if not isinstance(value, list):
            return []
        return [k for k in value if k in ALL_PRIVILEGES]

    # ── Representation ────────────────────────────────────────────────────────

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['username']       = instance.user.username if instance.user else ''
        data['email']          = instance.user.email    if instance.user else ''
        data['privileges']     = instance.privileges    or []
        data['is_super_admin'] = instance.is_super_admin
        return data

    # ── Create ────────────────────────────────────────────────────────────────

    def create(self, validated_data):
        from recognition.encoding import save_base64_image, compute_and_store_encodings_async as compute_and_store_encodings
        from recognition.models import BiometricData
        from django.contrib.contenttypes.models import ContentType

        username = validated_data.pop('username', None)
        password = validated_data.pop('password', None)
        email    = validated_data.pop('email', '')
        tag      = validated_data.pop('tag', '')

        profile_image_b64 = validated_data.pop('profile_image_base64', '')
        b64_fields = {k: validated_data.pop(k, '') for k in [
            'face_scan_1_base64', 'face_scan_2_base64',
            'face_scan_3_base64', 'face_scan_4_base64', 'face_scan_5_base64',
            'id_card_front_base64', 'id_card_back_base64',
        ]}

        validated_data['digital_id'] = f'ADM-{uuid.uuid4().hex[:8].upper()}'
        if tag:
            validated_data['admin_tag'] = tag

        if username and password:
            user = CustomUser.objects.create_user(
                username=username, password=password, email=email, role='admin'
            )
            validated_data['user'] = user

        profile = AdminProfile.objects.create(**validated_data)

        if profile_image_b64:
            save_base64_image(profile_image_b64, 'profile.jpg', profile.profile_image)
            profile.save(update_fields=['profile_image'])

        if b64_fields.get('id_card_front_base64'):
            save_base64_image(b64_fields['id_card_front_base64'], 'id_card.jpg', profile.id_card_image)
            profile.save(update_fields=['id_card_image'])
        elif b64_fields.get('id_card_back_base64'):
            save_base64_image(b64_fields['id_card_back_base64'], 'id_card.jpg', profile.id_card_image)
            profile.save(update_fields=['id_card_image'])

        bio = BiometricData(
            content_type=ContentType.objects.get_for_model(profile),
            object_id=profile.id,
        )
        _save_biometrics(bio, b64_fields)
        bio.save()
        compute_and_store_encodings(bio)

        return profile

    # ── Update ────────────────────────────────────────────────────────────────

    def update(self, instance, validated_data):
        from recognition.encoding import save_base64_image, compute_and_store_encodings_async as compute_and_store_encodings
        from recognition.models import BiometricData
        from django.contrib.contenttypes.models import ContentType

        username = validated_data.pop('username', None)
        password = validated_data.pop('password', None)
        email    = validated_data.pop('email', None)
        validated_data.pop('tag', None)

        profile_image_b64 = validated_data.pop('profile_image_base64', '')
        b64_fields = {k: validated_data.pop(k, '') for k in [
            'face_scan_1_base64', 'face_scan_2_base64',
            'face_scan_3_base64', 'face_scan_4_base64', 'face_scan_5_base64',
            'id_card_front_base64', 'id_card_back_base64',
        ]}

        if username and instance.user:
            instance.user.username = username
        if password and instance.user:
            instance.user.set_password(password)
        if email and instance.user:
            instance.user.email = email
        if instance.user and (username or password or email):
            instance.user.save()

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if profile_image_b64:
            save_base64_image(profile_image_b64, 'profile.jpg', instance.profile_image)
            instance.save(update_fields=['profile_image'])

        if b64_fields.get('id_card_front_base64'):
            save_base64_image(b64_fields['id_card_front_base64'], 'id_card.jpg', instance.id_card_image)
            instance.save(update_fields=['id_card_image'])
        elif b64_fields.get('id_card_back_base64'):
            save_base64_image(b64_fields['id_card_back_base64'], 'id_card.jpg', instance.id_card_image)
            instance.save(update_fields=['id_card_image'])

        content_type = ContentType.objects.get_for_model(instance)
        bio, _ = BiometricData.objects.get_or_create(content_type=content_type, object_id=instance.id)
        _save_biometrics(bio, b64_fields)
        bio.save()
        if any(b64_fields.values()):
            compute_and_store_encodings(bio)

        return instance


def _save_biometrics(bio, b64_fields):
    from recognition.encoding import save_base64_image
    mapping = [
        ('face_scan_1_base64', 'face_front'),
        ('face_scan_2_base64', 'face_left'),
        ('face_scan_3_base64', 'face_right'),
        ('face_scan_4_base64', 'face_down'),
        ('face_scan_5_base64', 'face_unusual'),
        ('id_card_front_base64', 'id_card_front'),
        ('id_card_back_base64', 'id_card_back'),
    ]
    for b64_key, field_name in mapping:
        if field_name and b64_fields.get(b64_key):
            save_base64_image(b64_fields[b64_key], f'{field_name}.jpg', getattr(bio, field_name))