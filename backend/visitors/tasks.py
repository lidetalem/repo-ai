"""
visitors/tasks.py
AMECO — Celery periodic task: delete expired visitors daily.
"""

from celery import shared_task


@shared_task
def delete_expired_visitors():
    """
    Runs daily (scheduled via Celery Beat).
    Deletes Visitor records where date_of_expiry < today.
    """
    from django.utils import timezone
    from visitors.models import Visitor

    today = timezone.now().date()
    expired = Visitor.objects.filter(date_of_expiry__lt=today)
    count = expired.count()
    expired.delete()
    return f'Deleted {count} expired visitor(s).'