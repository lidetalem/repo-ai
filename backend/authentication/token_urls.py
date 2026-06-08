from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    path('', TokenRefreshView.as_view(), name='token-refresh'),
]