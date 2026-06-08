from django.urls import path
from .views import (
    FaceScanView, MultiFaceScanView,
    ReloadEncodingCacheView, CacheStatsView,
)

urlpatterns = [
    path('scan/',       FaceScanView.as_view(),           name='face-scan'),
    path('scan/multi/', MultiFaceScanView.as_view(),      name='face-scan-multi'),
    path('reload/',     ReloadEncodingCacheView.as_view(), name='reload-cache'),
    path('stats/',      CacheStatsView.as_view(),         name='cache-stats'),
]