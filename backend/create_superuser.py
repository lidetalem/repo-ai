import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
import django
django.setup()
from django.contrib.auth import get_user_model
User = get_user_model()
username = os.environ.get('DJANGO_SUPERUSER_USERNAME', 'admin')
email = os.environ.get('DJANGO_SUPERUSER_EMAIL', 'admin@example.com')
password = os.environ.get('DJANGO_SUPERUSER_PASSWORD', 'AdminPass123!')
if User.objects.filter(username=username).exists():
    print('Superuser already exists:', username)
else:
    User.objects.create_superuser(username=username, email=email, password=password)
    print('Superuser created:', username, email)
