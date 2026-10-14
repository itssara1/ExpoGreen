from django.urls import path

from . import views


app_name = "recycling"

urlpatterns = [
    path("", views.home, name="home"),
    path("session/", views.session_detail, name="session_detail"),
    path("test-model/", views.classifier_test, name="classifier_test"),
    path("live/", views.live_test, name="live_test"),
    path("live/classify/", views.live_classify, name="live_classify"),
    path(
    "live/finalize/",
    views.finalize_live,
    name="finalize_live",
),
path(
    "tickets/new/",
    views.create_ticket,
    name="create_ticket",
),
path(
    "tickets/ready/",
    views.ticket_ready,
    name="ticket_ready",
),
]