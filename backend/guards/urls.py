from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import GuardProfileViewSet

router = DefaultRouter()
router.register('', GuardProfileViewSet, basename='guard')

urlpatterns = [path('', include(router.urls))]