new = '''from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('visitors', '0001_initial'),
    ]

    operations = [
        # Add missing columns only if they don't already exist to make this
        # migration safe to run against databases with partial schema changes.
        migrations.RunSQL(
            sql=(
                "ALTER TABLE visitor_profile ADD COLUMN IF NOT EXISTS expiry_datetime timestamptz NULL;"
            ),
            reverse_sql=(
                "ALTER TABLE visitor_profile DROP COLUMN IF EXISTS expiry_datetime;"
            ),
        ),
        migrations.RunSQL(
            sql=(
                "ALTER TABLE visitor_profile ADD COLUMN IF NOT EXISTS status varchar(10) NOT NULL DEFAULT 'Pending';"
            ),
            reverse_sql=(
                "ALTER TABLE visitor_profile DROP COLUMN IF EXISTS status;"
            ),
        ),
        migrations.RunSQL(
            sql=(
                "ALTER TABLE visitor_profile ADD COLUMN IF NOT EXISTS is_approved boolean NOT NULL DEFAULT false;"
            ),
            reverse_sql=(
                "ALTER TABLE visitor_profile DROP COLUMN IF EXISTS is_approved;"
            ),
        ),
        migrations.RunSQL(
            sql=(
                "ALTER TABLE visitor_request ADD COLUMN IF NOT EXISTS guard_image varchar(512) NOT NULL DEFAULT ''::varchar;"
            ),
            reverse_sql=(
                "ALTER TABLE visitor_request DROP COLUMN IF EXISTS guard_image;"
            ),
        ),
    ]
'''

path = r'c:\Users\Administrator\Downloads\AMECO+++\AMECO\backend\visitors\migrations\0002_visitor_expiry_datetime_status_approval.py'
with open(path, 'w', encoding='utf-8') as f:
    f.write(new)
print('Wrote', path)
