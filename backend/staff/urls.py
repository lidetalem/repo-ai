from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import StaffProfileViewSet
from .import_views import StaffImportPreviewView, StaffImportRunView

router = DefaultRouter()
router.register('', StaffProfileViewSet, basename='staff')

urlpatterns = [
    path('import/preview/', StaffImportPreviewView.as_view(), name='staff-import-preview'),
    path('import/run/',     StaffImportRunView.as_view(),     name='staff-import-run'),
    path('', include(router.urls)),
]
