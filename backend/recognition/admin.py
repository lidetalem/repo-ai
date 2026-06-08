from django.contrib import admin
from .models import BiometricData


@admin.register(BiometricData)
class BiometricDataAdmin(admin.ModelAdmin):
    list_display = ('content_type', 'object_id', 'created_at')
    readonly_fields = ('face_encodings',)