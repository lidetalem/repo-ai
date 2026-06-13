"""
staff/serializers.py
"""
import uuid
import logging
from rest_framework import serializers
from .models import StaffProfile

logger = logging.getLogger(__name__)


class StaffProfileSerializer(serializers.ModelSerializer):
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
    # aliases expected by frontend
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
        model = StaffProfile
        fields = '__all__'
        read_only_fields = ('digital_id', 'registered_at')

    def create(self, validated_data):
        from recognition.encoding import save_base64_image, compute_and_store_encodings_async as compute_and_store_encodings
        from recognition.models import BiometricData
        from django.contrib.contenttypes.models import ContentType

        try:
            profile_image_b64 = validated_data.pop('profile_image_base64', '')
            b64_fields = {k: validated_data.pop(k, '') for k in [
                'face_scan_1_base64', 'face_scan_2_base64',
                'face_scan_3_base64', 'face_scan_4_base64', 'face_scan_5_base64',
                'id_card_front_base64', 'id_card_back_base64',
            ]}

            validated_data['digital_id'] = f'STF-{uuid.uuid4().hex[:8].upper()}'
            profile = StaffProfile.objects.create(**validated_data)
            logger.info(f'Created staff profile: {profile.digital_id}')

            if profile_image_b64:
                try:
                    save_base64_image(profile_image_b64, 'profile.jpg', profile.profile_image)
                    profile.save(update_fields=['profile_image'])
                except Exception as e:
                    logger.error(f'Failed to save profile image: {e}')

            if b64_fields.get('id_card_front_base64'):
                try:
                    save_base64_image(b64_fields['id_card_front_base64'], 'id_card.jpg', profile.id_card_image)
                    profile.save(update_fields=['id_card_image'])
                except Exception as e:
                    logger.error(f'Failed to save ID card front: {e}')
            elif b64_fields.get('id_card_back_base64'):
                try:
                    save_base64_image(b64_fields['id_card_back_base64'], 'id_card.jpg', profile.id_card_image)
                    profile.save(update_fields=['id_card_image'])
                except Exception as e:
                    logger.error(f'Failed to save ID card back: {e}')

            bio = BiometricData(
                content_type=ContentType.objects.get_for_model(profile),
                object_id=profile.id,
            )
            bio.save()
            logger.info(f'Created biometric data for staff: {profile.digital_id}')

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
                    try:
                        save_base64_image(b64_fields[b64_key], f'{field_name}.jpg', getattr(bio, field_name))
                    except Exception as e:
                        logger.error(f'Failed to save biometric {field_name}: {e}')

            if any(b64_fields.values()):
                try:
                    bio.save()
                    compute_and_store_encodings(bio)
                    logger.info(f'Computed encodings for staff: {profile.digital_id}')
                except Exception as e:
                    logger.error(f'Failed to compute encodings: {e}')

            return profile
        except Exception as e:
            logger.error(f'Error creating staff profile: {str(e)}', exc_info=True)
            raise

    def update(self, instance, validated_data):
        from recognition.encoding import save_base64_image, compute_and_store_encodings_async as compute_and_store_encodings
        from recognition.models import BiometricData
        from django.contrib.contenttypes.models import ContentType

        try:
            profile_image_b64 = validated_data.pop('profile_image_base64', '')
            b64_fields = {k: validated_data.pop(k, '') for k in [
                'face_scan_1_base64', 'face_scan_2_base64',
                'face_scan_3_base64', 'face_scan_4_base64', 'face_scan_5_base64',
                'id_card_front_base64', 'id_card_back_base64',
            ]}

            for attr, value in validated_data.items():
                setattr(instance, attr, value)
            instance.save()
            logger.info(f'Updated staff profile: {instance.digital_id}')

            if profile_image_b64:
                try:
                    save_base64_image(profile_image_b64, 'profile.jpg', instance.profile_image)
                    instance.save(update_fields=['profile_image'])
                except Exception as e:
                    logger.error(f'Failed to save profile image: {e}')

            if b64_fields.get('id_card_front_base64'):
                try:
                    save_base64_image(b64_fields['id_card_front_base64'], 'id_card.jpg', instance.id_card_image)
                    instance.save(update_fields=['id_card_image'])
                except Exception as e:
                    logger.error(f'Failed to save ID card front: {e}')
            elif b64_fields.get('id_card_back_base64'):
                try:
                    save_base64_image(b64_fields['id_card_back_base64'], 'id_card.jpg', instance.id_card_image)
                    instance.save(update_fields=['id_card_image'])
                except Exception as e:
                    logger.error(f'Failed to save ID card back: {e}')

            content_type = ContentType.objects.get_for_model(instance)
            bio, created = BiometricData.objects.get_or_create(content_type=content_type, object_id=instance.id)
            if created:
                logger.info(f'Created new biometric data for staff: {instance.digital_id}')

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
                    try:
                        save_base64_image(b64_fields[b64_key], f'{field_name}.jpg', getattr(bio, field_name))
                    except Exception as e:
                        logger.error(f'Failed to save biometric {field_name}: {e}')

            if any(b64_fields.values()):
                try:
                    bio.save()
                    compute_and_store_encodings(bio)
                    logger.info(f'Updated encodings for staff: {instance.digital_id}')
                except Exception as e:
                    logger.error(f'Failed to compute encodings: {e}')

            return instance

        except Exception as e:
            logger.error(f'Error updating staff profile: {str(e)}', exc_info=True)
            raise

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

    # frontend aliases (face_scan_1..5)
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
        # return existing id_card_image from the profile (not biometric id_card_front/back)
        request = self.context.get('request')
        try:
            if obj.id_card_image:
                return request.build_absolute_uri(obj.id_card_image.url) if request else (obj.id_card_image.url if obj.id_card_image else None)
        except Exception:
            return None