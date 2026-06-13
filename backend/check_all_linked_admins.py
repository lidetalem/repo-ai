from admins.models import AdminProfile
from recognition.models import BiometricData
from django.contrib.contenttypes.models import ContentType

admins = AdminProfile.objects.filter(linked_staff__isnull=False).select_related('linked_staff')
print('Linked admins found:', admins.count())
for admin in admins:
    print('\n--- Admin', admin.id, '---')
    print('admin.profile_image', bool(admin.profile_image), (admin.profile_image.url if getattr(admin.profile_image, 'name', None) else None))
    staff = admin.linked_staff
    print('linked staff id', staff.id, 'profile_image', bool(staff.profile_image), (staff.profile_image.url if getattr(staff.profile_image, 'name', None) else None))

    # Admin biometric
    ct_admin = ContentType.objects.get_for_model(admin)
    bio_admin = BiometricData.objects.filter(content_type=ct_admin, object_id=admin.id).first()
    print('admin bio', bool(bio_admin))
    if bio_admin:
        for f in ['face_front','face_left','face_right','face_down','face_unusual','id_card_front','id_card_back']:
            attr = getattr(bio_admin, f)
            print('  admin', f, bool(attr), (attr.url if getattr(attr, 'name', None) else None))

    # Staff biometric
    ct_staff = ContentType.objects.get_for_model(staff)
    bio_staff = BiometricData.objects.filter(content_type=ct_staff, object_id=staff.id).first()
    print('staff bio', bool(bio_staff))
    if bio_staff:
        for f in ['face_front','face_left','face_right','face_down','face_unusual','id_card_front','id_card_back']:
            attr = getattr(bio_staff, f)
            print('  staff', f, bool(attr), (attr.url if getattr(attr, 'name', None) else None))
