from django.contrib import admin
from .models import AdminProfile


@admin.register(AdminProfile)
class AdminProfileAdmin(admin.ModelAdmin):
    list_display = ('first_name', 'last_name', 'admin_tag', 'digital_id', 'registered_at')
    search_fields = ('first_name', 'last_name', 'digital_id')