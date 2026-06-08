from django.apps import AppConfig


class AttendanceConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'attendance'

    def ready(self):
        # Start the background overstay checker thread on server startup
        import threading, time, logging
        logger = logging.getLogger(__name__)

        def _overstay_loop():
            import django
            while True:
                time.sleep(60)   # check every 60 seconds
                try:
                    from attendance.engine import check_overstay
                    fired = check_overstay()
                    if fired:
                        logger.info('[Overstay checker] %d alert(s) fired', len(fired))
                except Exception as exc:
                    logger.error('[Overstay checker] Error: %s', exc)

        t = threading.Thread(target=_overstay_loop, daemon=True, name='OverstayChecker')
        t.start()
        logger.info('[Overstay checker] Background thread started.')
