from django.contrib import admin
from .models import GuardProfile


@admin.register(GuardProfile)
class GuardProfileAdmin(admin.ModelAdmin):
    list_display = ('first_name', 'last_name', 'guard_tag', 'digital_id', 'registered_at')
    search_fields = ('first_name', 'last_name', 'username', 'digital_id')