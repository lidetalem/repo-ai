from django.core.management.base import BaseCommand, CommandError


class FakeRequest:
    def __init__(self, base_url=None):
        self.base_url = base_url.rstrip('/') if base_url else None

    def build_absolute_uri(self, url):
        if not url:
            return None
        if url.startswith('http'):
            return url
        if self.base_url:
            return f"{self.base_url}{url if url.startswith('/') else '/' + url}"
        return url


class Command(BaseCommand):
    help = 'Print serialized JSON for a person record (staff|guards|visitors|admins) including image URL fields.'

    def add_arguments(self, parser):
        parser.add_argument('kind', choices=['staff', 'guards', 'visitors', 'admins'])
        parser.add_argument('pk', type=int)
        parser.add_argument('--base-url', dest='base_url', help='Base URL to prefix relative media URLs (e.g. http://localhost:8000)')

    def handle(self, *args, **options):
        kind = options['kind']
        pk = options['pk']
        base_url = options.get('base_url')

        mapping = {
            'staff':   ('staff.models', 'StaffProfile', 'staff.serializers', 'StaffProfileSerializer'),
            'guards':  ('guards.models', 'GuardProfile', 'guards.serializers', 'GuardProfileSerializer'),
            'visitors':('visitors.models', 'Visitor', 'visitors.serializers', 'VisitorSerializer'),
            'admins':  ('admins.models', 'AdminProfile', 'admins.serializers', 'AdminProfileSerializer'),
        }

        mod_models, model_name, mod_serializers, serializer_name = mapping[kind]

        try:
            models_mod = __import__(mod_models, fromlist=[model_name])
            Model = getattr(models_mod, model_name)
        except Exception as e:
            raise CommandError(f'Could not import model {model_name} from {mod_models}: {e}')

        try:
            ser_mod = __import__(mod_serializers, fromlist=[serializer_name])
            Serializer = getattr(ser_mod, serializer_name)
        except Exception as e:
            raise CommandError(f'Could not import serializer {serializer_name} from {mod_serializers}: {e}')

        try:
            obj = Model.objects.get(pk=pk)
        except Model.DoesNotExist:
            raise CommandError(f'{model_name} with pk={pk} does not exist')

        fake_req = FakeRequest(base_url)
        serializer = Serializer(obj, context={'request': fake_req})
        import json
        out = json.dumps(serializer.data, indent=2, ensure_ascii=False)
        self.stdout.write(out)
