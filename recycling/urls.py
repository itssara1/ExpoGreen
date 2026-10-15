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
    path(
        "session/status/",
        views.session_status,
        name="session_status",
    ),
    path(
    "ops/dashboard/",
    views.operations_dashboard,
    name="operations_dashboard",
),
    path(
    "ops/bins/<int:bin_id>/level/",
    views.update_bin_level,
    name="update_bin_level",
    ),
    path(
    "ops/bins/<int:bin_id>/emptied/",
    views.mark_bin_emptied,
    name="mark_bin_emptied",
),
    path(
    "ops/routes/<int:route_id>/start/",
    views.start_route,
    name="start_route",
),
    path(
    "ops/routes/<int:route_id>/complete/",
    views.complete_route,
    name="complete_route",
),
]