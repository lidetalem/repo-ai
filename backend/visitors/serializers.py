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

    class Meta:
        model = Visitor
        fields = '__all__'
        read_only_fields = ('digital_id', 'registered_at')

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