from django.urls import path
from . import views

urlpatterns = [
    path('chat/', views.chat),
    path('reason/', views.reason),
    path('image/', views.image),
    path('transcribe/', views.transcribe),
    path('speak/', views.speak),
]