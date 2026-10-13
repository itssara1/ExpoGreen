from django.urls import path

from . import views


app_name = "recycling"

urlpatterns = [
    path("", views.home, name="home"),
    path("session/", views.session_detail, name="session_detail"),
]