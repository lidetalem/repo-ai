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
    # Read-only image URL fields (populate from BiometricData)
    face_front = serializers.SerializerMethodField(read_only=True)
    face_left = serializers.SerializerMethodField(read_only=True)
    face_right = serializers.SerializerMethodField(read_only=True)
    face_down = serializers.SerializerMethodField(read_only=True)
    face_unusual = serializers.SerializerMethodField(read_only=True)
    face_scan_1 = serializers.SerializerMethodField(read_only=True)
    face_scan_2 = serializers.SerializerMethodField(read_only=True)
    face_scan_3 = serializers.SerializerMethodField(read_only=True)
    face_scan_4 = serializers.SerializerMethodField(read_only=True)
    face_scan_5 = serializers.SerializerMethodField(read_only=True)
    id_card_front = serializers.SerializerMethodField(read_only=True)
    id_card_back = serializers.SerializerMethodField(read_only=True)
    profile_image_url = serializers.SerializerMethodField(read_only=True)
    # Alias expected by some frontend views: expose profile image under `profile_image`
    profile_image = serializers.SerializerMethodField(read_only=True)
    id_card_image = serializers.SerializerMethodField(read_only=True)

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

    # ── Read-only image URLs (delegate to module helpers) ───────────────────
    def get_face_front(self, obj):
        return get_face_front(obj, self.context)

    def get_face_left(self, obj):
        return get_face_left(obj, self.context)

    def get_face_right(self, obj):
        return get_face_right(obj, self.context)

    def get_face_down(self, obj):
        return get_face_down(obj, self.context)

    def get_face_unusual(self, obj):
        return get_face_unusual(obj, self.context)

    def get_face_scan_1(self, obj):
        return get_face_scan_1(obj, self.context)

    def get_face_scan_2(self, obj):
        return get_face_scan_2(obj, self.context)

    def get_face_scan_3(self, obj):
        return get_face_scan_3(obj, self.context)

    def get_face_scan_4(self, obj):
        return get_face_scan_4(obj, self.context)

    def get_face_scan_5(self, obj):
        return get_face_scan_5(obj, self.context)

    def get_id_card_front(self, obj):
        return get_id_card_front(obj, self.context)

    def get_id_card_back(self, obj):
        return get_id_card_back(obj, self.context)

    def get_profile_image_url(self, obj):
        return get_profile_image_url(obj, self.context)

    def get_profile_image(self, obj):
        # Keep backwards compatibility: some frontends use `profile_image` key
        return get_profile_image_url(obj, self.context)

    def get_id_card_image(self, obj):
        return get_id_card_image(obj, self.context)

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


def _get_bio(obj, context=None):
    from recognition.models import BiometricData
    from django.contrib.contenttypes.models import ContentType
    ct = ContentType.objects.get_for_model(obj)
    bio = BiometricData.objects.filter(content_type=ct, object_id=obj.id).first()
    # If this admin is linked to a StaffProfile and the admin biometric either
    # doesn't exist or contains no image files, fall back to the linked
    # staff's biometric so images remain visible.
    def _has_images(b):
        if not b:
            return False
        for f in ('face_front','face_left','face_right','face_down','face_unusual','id_card_front','id_card_back'):
            try:
                if getattr(b, f) and getattr(getattr(b, f), 'name', None):
                    return True
            except Exception:
                continue
        return False

    try:
        if (bio is None or not _has_images(bio)) and hasattr(obj, 'linked_staff') and obj.linked_staff:
            staff = obj.linked_staff
            ct2 = ContentType.objects.get_for_model(staff)
            bio2 = BiometricData.objects.filter(content_type=ct2, object_id=staff.id).first()
            if _has_images(bio2):
                bio = bio2
    except Exception:
        pass

    return bio


def _url_for(request, field):
    if not field:
        return None
    try:
        if request:
            return request.build_absolute_uri(field.url)
        # No request (internal calls) — return the relative/media URL
        return field.url
    except Exception:
        return None


def get_face_front(obj, context=None):
    bio = _get_bio(obj)
    return _url_for(context.get('request') if context else None, getattr(bio, 'face_front', None))


def get_face_left(obj, context=None):
    bio = _get_bio(obj)
    return _url_for(context.get('request') if context else None, getattr(bio, 'face_left', None))


def get_face_right(obj, context=None):
    bio = _get_bio(obj)
    return _url_for(context.get('request') if context else None, getattr(bio, 'face_right', None))


def get_face_down(obj, context=None):
    bio = _get_bio(obj)
    return _url_for(context.get('request') if context else None, getattr(bio, 'face_down', None))


def get_face_unusual(obj, context=None):
    bio = _get_bio(obj)
    return _url_for(context.get('request') if context else None, getattr(bio, 'face_unusual', None))


def get_face_scan_1(obj, context=None):
    return get_face_front(obj, context)


def get_face_scan_2(obj, context=None):
    return get_face_left(obj, context)


def get_face_scan_3(obj, context=None):
    return get_face_right(obj, context)


def get_face_scan_4(obj, context=None):
    return get_face_down(obj, context)


def get_face_scan_5(obj, context=None):
    return get_face_unusual(obj, context)


def get_id_card_front(obj, context=None):
    bio = _get_bio(obj)
    return _url_for(context.get('request') if context else None, getattr(bio, 'id_card_front', None))


def get_id_card_back(obj, context=None):
    bio = _get_bio(obj)
    return _url_for(context.get('request') if context else None, getattr(bio, 'id_card_back', None))


def get_profile_image_url(obj, context=None):
    try:
        # Prefer AdminProfile.profile_image, fall back to linked StaffProfile.profile_image
        req = context.get('request') if context else None
        if obj.profile_image:
            return req.build_absolute_uri(obj.profile_image.url) if req else (obj.profile_image.url if obj.profile_image else None)
        try:
            if hasattr(obj, 'linked_staff') and obj.linked_staff and obj.linked_staff.profile_image:
                return req.build_absolute_uri(obj.linked_staff.profile_image.url) if req else obj.linked_staff.profile_image.url
        except Exception:
            pass
        return None
    except Exception:
        return None


def get_id_card_image(obj, context=None):
    try:
        if obj.id_card_image:
            req = context.get('request') if context else None
            return req.build_absolute_uri(obj.id_card_image.url) if req else (obj.id_card_image.url if obj.id_card_image else None)
    except Exception:
        return None