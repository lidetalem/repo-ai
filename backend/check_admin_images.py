from admins.models import AdminProfile
from admins.serializers import AdminProfileSerializer
import json

admin = AdminProfile.objects.filter(linked_staff__isnull=False).select_related('linked_staff').first()
print('FOUND', bool(admin))
if admin:
    print('admin id', admin.id, 'admin.profile_image', bool(admin.profile_image))
    s = AdminProfileSerializer(admin, context={'request': None}).data
    keys = ['profile_image_url','id_card_image','face_front','face_left','face_right','face_down','face_unusual','face_scan_1','face_scan_2','face_scan_3','face_scan_4','face_scan_5','id_card_front','id_card_back']
    out = {k: s.get(k) for k in keys}
    print(json.dumps(out, indent=2))
else:
    print('No linked admin found.')
