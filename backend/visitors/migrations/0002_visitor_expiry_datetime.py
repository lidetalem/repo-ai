from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('visitors', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='visitor',
            name='expiry_datetime',
            field=models.DateTimeField(
                blank=True,
                null=True,
                help_text=(
                    'Full date and time when this visitor expires. '
                    'Takes precedence over date_of_expiry when set.'
                ),
            ),
        ),
    ]
