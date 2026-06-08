"""
AMECO — Main URL configuration.
"""

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/',          include('authentication.urls')),
    path('api/admins/',        include('admins.urls')),
    path('api/guard/',         include('guards.urls')),
    path('api/staff/',         include('staff.urls')),
    path('api/temporary-users/', include('visitors.urls')),
    path('api/temporary-requests/', include('visitors.request_urls')),
    path('api/camera/',        include('cameras.urls')),
    path('api/logs/',          include('logs.urls')),
    path('api/notifications/', include('notifications.urls')),
    path('api/recognition/',   include('recognition.urls')),
    path('api/tts/',           include('tts.urls')),
    path('api/token/refresh/', include('authentication.token_urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)