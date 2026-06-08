from django.urls import path
from .views import speak_amharic

urlpatterns = [
    path('', speak_amharic, name='speak_amharic'),
]
