from django.contrib import admin
from .models import StaffProfile


@admin.register(StaffProfile)
class StaffProfileAdmin(admin.ModelAdmin):
    list_display = ('first_name', 'last_name', 'position', 'department', 'digital_id', 'registered_at')
    search_fields = ('first_name', 'last_name', 'position', 'digital_id')