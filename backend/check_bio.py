from admins.models import AdminProfile
from recognition.models import BiometricData

admin = AdminProfile.objects.filter(linked_staff__isnull=False).select_related('linked_staff').first()
if not admin:
    print('No linked admin found')
else:
    staff = admin.linked_staff
    print('Staff id', staff.id)
    bio = BiometricData.objects.filter(content_type__model__iexact='staffprofile', object_id=staff.id).first()
    print('bio found', bool(bio))
    if bio:
        for f in ['face_front','face_left','face_right','face_down','face_unusual','id_card_front','id_card_back']:
            attr = getattr(bio, f)
            print(f, bool(attr), getattr(attr, 'url', None))
