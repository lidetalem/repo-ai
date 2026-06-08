from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import VisitorViewSet

router = DefaultRouter()
router.register('profiles', VisitorViewSet, basename='visitor')

urlpatterns = [path('', include(router.urls))]