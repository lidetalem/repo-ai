
import os
import sys
import django

# Ensure backend package root is on sys.path so 'core' can be imported
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.db import connection

queries = [
    "ALTER TABLE visitor_profile ADD COLUMN IF NOT EXISTS expiry_datetime timestamptz NULL;",
    "ALTER TABLE visitor_profile ADD COLUMN IF NOT EXISTS status varchar(10) NOT NULL DEFAULT 'Pending';",
    "ALTER TABLE visitor_profile ADD COLUMN IF NOT EXISTS is_approved boolean NOT NULL DEFAULT false;",
    "ALTER TABLE visitor_request ADD COLUMN IF NOT EXISTS guard_image varchar(512) NOT NULL DEFAULT ''::varchar;",
]

with connection.cursor() as cursor:
    for q in queries:
        print('Executing:', q)
        cursor.execute(q)

print('Done')
