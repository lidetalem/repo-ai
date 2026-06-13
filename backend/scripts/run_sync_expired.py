import os
import sys
import django
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

django.setup()

from visitors.views import _sync_expired

print('Running _sync_expired()...')
try:
    _sync_expired()
    print('Completed without error')
except Exception as e:
    print('Error:', type(e), e)
