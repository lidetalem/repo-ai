"""
recognition/apps.py
AMECO — Warms the face-encoding cache when Django starts.
"""
from django.apps import AppConfig


class RecognitionConfig(AppConfig):
    name          = 'recognition'
    default_auto_field = 'django.db.models.BigAutoField'

    def ready(self):
        """Called once Django is fully initialised (manage.py runserver, gunicorn, etc.)."""
        import os
        import sys
        import threading

        # Skip during migrations, test collection, or management commands
        # that don't need the ML stack.
        if os.environ.get('DJANGO_SKIP_CACHE_WARM'):
            return

        if len(sys.argv) > 1 and sys.argv[1] in {
            'makemigrations',
            'migrate',
            'collectstatic',
            'shell',
            'check',
            'test',
            'compilemessages',
            'dbshell',
            'flush',
            'loaddata',
            'dumpdata',
        }:
            return

        try:
            from recognition.encoding import load_all_encodings
            thread = threading.Thread(
                target=self._warm_cache,
                args=(load_all_encodings,),
                daemon=True,
            )
            thread.start()
        except Exception as exc:
            import logging
            logging.getLogger(__name__).warning(
                'Could not schedule recognition cache warm: %s', exc
            )

    def _warm_cache(self, loader):
        try:
            loader()
        except Exception as exc:
            import logging
            logging.getLogger(__name__).warning(
                'Could not warm recognition cache asynchronously: %s', exc
            )