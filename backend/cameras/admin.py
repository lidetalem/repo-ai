from django.contrib import admin
from .models import GateWithCamera


@admin.register(GateWithCamera)
class GateWithCameraAdmin(admin.ModelAdmin):
    list_display = ('gate_name', 'camera_name', 'terminal_id', 'power', 'status', 'created_at')
    list_filter = ('power', 'status')
    search_fields = ('gate_name', 'terminal_id')