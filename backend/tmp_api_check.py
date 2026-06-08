import os
import django
from django.test import Client
from django.contrib.auth import get_user_model

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
User = get_user_model()
if not User.objects.filter(username='tmp_superadmin').exists():
    User.objects.create_superuser('tmp_superadmin', 'tmp@example.com', 'Password123!')

client = Client()
client.defaults['HTTP_HOST'] = '127.0.0.1'
resp = client.post('/api/auth/login/', {'username': 'tmp_superadmin', 'password': 'Password123!'})
print('login', resp.status_code, resp.content)
if resp.status_code == 200:
    data = resp.json()
    token = data['access']
    client.defaults['HTTP_AUTHORIZATION'] = f'Bearer {token}'
    for path in ['/api/staff/', '/api/admins/management/', '/api/logs/history/']:
        r = client.get(path)
        print(path, r.status_code, r.content[:500])
