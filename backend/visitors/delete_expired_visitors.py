"""
visitors/management/commands/delete_expired_visitors.py
Run daily via Celery Beat or cron:
  python manage.py delete_expired_visitors
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from visitors.models import Visitor


class Command(BaseCommand):
    help = 'Delete visitors whose date_of_expiry has passed.'

    def handle(self, *args, **options):
        today = timezone.now().date()
        expired = Visitor.objects.filter(date_of_expiry__lt=today)
        count = expired.count()
        expired.delete()
        self.stdout.write(self.style.SUCCESS(f'Deleted {count} expired visitor(s).'))