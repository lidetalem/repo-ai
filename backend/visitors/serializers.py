"""
visitors/serializers.py
"""
import uuid
from rest_framework import serializers
from .models import Visitor, VisitorRequest


class VisitorSerializer(serializers.ModelSerializer):
    profile_image_base64  = serializers.CharField(write_only=True, required=False, allow_blank=True)
    face_scan_1_base64    = serializers.CharField(write_only=True, required=False, allow_blank=True)
    face_scan_2_base64    = serializers.CharField(write_only=True, required=False, allow_blank=True)
    face_scan_3_base64    = serializers.CharField(write_only=True, required=False, allow_blank=True)
    face_scan_4_base64    = serializers.CharField(write_only=True, required=False, allow_blank=True)
    face_scan_5_base64    = serializers.CharField(write_only=True, required=False, allow_blank=True)
    id_card_front_base64  = serializers.CharField(write_only=True, required=False, allow_blank=True)
    id_card_back_base64   = serializers.CharField(write_only=True, required=False, allow_blank=True)
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
    id_card_image = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Visitor
        fields = '__all__'
        read_only_fields = ('digital_id', 'registered_at', 'status')

    def create(self, validated_data):
        from recognition.encoding import save_base64_image, compute_and_store_encodings
        from recognition.models import BiometricData
        from django.contrib.contenttypes.models import ContentType

        profile_image_b64 = validated_data.pop('profile_image_base64', '')
        b64_fields = {k: validated_data.pop(k, '') for k in [
            'face_scan_1_base64', 'face_scan_2_base64',
            'face_scan_3_base64', 'face_scan_4_base64', 'face_scan_5_base64',
            'id_card_front_base64', 'id_card_back_base64',
        ]}

        validated_data['digital_id'] = f'VIS-{uuid.uuid4().hex[:8].upper()}'
        visitor = Visitor.objects.create(**validated_data)

        if profile_image_b64:
            save_base64_image(profile_image_b64, 'profile.jpg', visitor.profile_image)
            visitor.save(update_fields=['profile_image'])

        if b64_fields.get('id_card_front_base64'):
            save_base64_image(b64_fields['id_card_front_base64'], 'id_card.jpg', visitor.id_card_image)
            visitor.save(update_fields=['id_card_image'])
        elif b64_fields.get('id_card_back_base64'):
            save_base64_image(b64_fields['id_card_back_base64'], 'id_card.jpg', visitor.id_card_image)
            visitor.save(update_fields=['id_card_image'])

        bio = BiometricData(
            content_type=ContentType.objects.get_for_model(visitor),
            object_id=visitor.id,
        )
        for b64_key, field_name in [
            ('face_scan_1_base64', 'face_front'),
            ('face_scan_2_base64', 'face_left'),
            ('face_scan_3_base64', 'face_right'),
            ('face_scan_4_base64', 'face_down'),
            ('face_scan_5_base64', 'face_unusual'),
            ('id_card_front_base64', 'id_card_front'),
            ('id_card_back_base64', 'id_card_back'),
        ]:
            if b64_fields.get(b64_key):
                save_base64_image(b64_fields[b64_key], f'{field_name}.jpg', getattr(bio, field_name))
        bio.save()
        compute_and_store_encodings(bio)
        return visitor

    def update(self, instance, validated_data):
        from recognition.encoding import save_base64_image, compute_and_store_encodings
        from recognition.models import BiometricData
        from django.contrib.contenttypes.models import ContentType

        profile_image_b64 = validated_data.pop('profile_image_base64', '')
        b64_fields = {k: validated_data.pop(k, '') for k in [
            'face_scan_1_base64', 'face_scan_2_base64',
            'face_scan_3_base64', 'face_scan_4_base64', 'face_scan_5_base64',
            'id_card_front_base64', 'id_card_back_base64',
        ]}

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
        for b64_key, field_name in [
            ('face_scan_1_base64', 'face_front'),
            ('face_scan_2_base64', 'face_left'),
            ('face_scan_3_base64', 'face_right'),
            ('face_scan_4_base64', 'face_down'),
            ('face_scan_5_base64', 'face_unusual'),
            ('id_card_front_base64', 'id_card_front'),
            ('id_card_back_base64', 'id_card_back'),
        ]:
            if b64_fields.get(b64_key):
                save_base64_image(b64_fields[b64_key], f'{field_name}.jpg', getattr(bio, field_name))
        bio.save()
        if any(b64_fields.values()):
            compute_and_store_encodings(bio)

        return instance

    # Helper to fetch BiometricData for this profile
    def _get_bio(self, obj):
        from recognition.models import BiometricData
        from django.contrib.contenttypes.models import ContentType
        ct = ContentType.objects.get_for_model(obj)
        return BiometricData.objects.filter(content_type=ct, object_id=obj.id).first()

    def _url_for(self, request, field):
        if not request or not field:
            return None
        try:
            return request.build_absolute_uri(field.url)
        except Exception:
            return None

    def get_face_front(self, obj):
        bio = self._get_bio(obj)
        return self._url_for(self.context.get('request'), getattr(bio, 'face_front', None))

    def get_face_left(self, obj):
        bio = self._get_bio(obj)
        return self._url_for(self.context.get('request'), getattr(bio, 'face_left', None))

    def get_face_right(self, obj):
        bio = self._get_bio(obj)
        return self._url_for(self.context.get('request'), getattr(bio, 'face_right', None))

    def get_face_down(self, obj):
        bio = self._get_bio(obj)
        return self._url_for(self.context.get('request'), getattr(bio, 'face_down', None))

    def get_face_unusual(self, obj):
        bio = self._get_bio(obj)
        return self._url_for(self.context.get('request'), getattr(bio, 'face_unusual', None))

    def get_face_scan_1(self, obj):
        return self.get_face_front(obj)

    def get_face_scan_2(self, obj):
        return self.get_face_left(obj)

    def get_face_scan_3(self, obj):
        return self.get_face_right(obj)

    def get_face_scan_4(self, obj):
        return self.get_face_down(obj)

    def get_face_scan_5(self, obj):
        return self.get_face_unusual(obj)

    def get_id_card_front(self, obj):
        bio = self._get_bio(obj)
        return self._url_for(self.context.get('request'), getattr(bio, 'id_card_front', None))

    def get_id_card_back(self, obj):
        bio = self._get_bio(obj)
        return self._url_for(self.context.get('request'), getattr(bio, 'id_card_back', None))

    def get_profile_image_url(self, obj):
        request = self.context.get('request')
        try:
            if obj.profile_image:
                return request.build_absolute_uri(obj.profile_image.url) if request else (obj.profile_image.url if obj.profile_image else None)
        except Exception:
            return None

    def get_id_card_image(self, obj):
        request = self.context.get('request')
        try:
            if obj.id_card_image:
                return request.build_absolute_uri(obj.id_card_image.url) if request else (obj.id_card_image.url if obj.id_card_image else None)
        except Exception:
            return None


class VisitorRequestSerializer(serializers.ModelSerializer):
    visitor_name    = serializers.SerializerMethodField(read_only=True)
    visitor_phone   = serializers.SerializerMethodField(read_only=True)
    visitor_image   = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = VisitorRequest
        fields = '__all__'
        read_only_fields = ('submitted_at', 'responded_at', 'status')

    def get_visitor_name(self, obj):
        return obj.temp_user.full_name() if obj.temp_user else ''

    def get_visitor_phone(self, obj):
        return obj.temp_user.phone if obj.temp_user else ''

    def get_visitor_image(self, obj):
        request = self.context.get('request')
        if obj.temp_user and obj.temp_user.profile_image and request:
            return request.build_absolute_uri(obj.temp_user.profile_image.url)
        return None