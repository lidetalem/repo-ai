import os
import sys
import django
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

django.setup()
from django.db import connection

def cols(table):
    with connection.cursor() as c:
        c.execute("SELECT column_name FROM information_schema.columns WHERE table_name=%s;", [table])
        return [r[0] for r in c.fetchall()]

print('visitor_profile columns:', cols('visitor_profile'))
print('visitor_request columns:', cols('visitor_request'))
