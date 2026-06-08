from django.contrib import admin
from .models import AccessLog


@admin.register(AccessLog)
class AccessLogAdmin(admin.ModelAdmin):
    list_display = ('actor_username', 'action_type', 'description', 'ethiopian_time', 'timestamp')
    list_filter = ('action_type', 'actor_role')
    search_fields = ('actor_username', 'description')
    readonly_fields = ('timestamp',)