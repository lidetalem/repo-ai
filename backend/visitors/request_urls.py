from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import VisitorRequestViewSet

router = DefaultRouter()
router.register('requests', VisitorRequestViewSet, basename='visitor-request')

urlpatterns = [path('', include(router.urls))]