from django.contrib import admin
from .models import Visitor, VisitorRequest


@admin.register(Visitor)
class VisitorAdmin(admin.ModelAdmin):
    list_display = ('first_name', 'last_name', 'phone', 'digital_id', 'date_of_expiry', 'registered_at')
    search_fields = ('first_name', 'last_name', 'digital_id')


@admin.register(VisitorRequest)
class VisitorRequestAdmin(admin.ModelAdmin):
    list_display = ('temp_user', 'guard_username', 'status', 'submitted_at', 'responded_at')
    list_filter = ('status',)