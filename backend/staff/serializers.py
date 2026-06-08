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