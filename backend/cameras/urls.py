# backend/cameras/urls.py
"""
Camera URL configuration.

Registers GateWithCameraViewSet at 'terminals', which generates:
  /api/camera/terminals/                   GET (list), POST (create)
  /api/camera/terminals/<id>/              GET, PATCH, DELETE
  /api/camera/terminals/<id>/toggle_power/ PATCH
  /api/camera/terminals/<id>/toggle_status/PATCH

Root urls.py must mount this with:
    path('api/camera/', include('cameras.urls')),
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import GateWithCameraViewSet

router = DefaultRouter()
router.register('terminals', GateWithCameraViewSet, basename='camera')

urlpatterns = [
    path('', include(router.urls)),
]
