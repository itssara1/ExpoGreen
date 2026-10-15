from django.contrib import admin

from .models import (
    Bin,
    CollectionPoint,
    CollectionRoute,
    DisposalSession,
    HardwareJob,
    PointEntry,
    RouteStop,
    Visitor,
)


@admin.register(Visitor)
class VisitorAdmin(admin.ModelAdmin):
    list_display = ("ticket_code", "points_balance", "created_at")
    search_fields = ("ticket_code", "name")


@admin.register(CollectionPoint)
class CollectionPointAdmin(admin.ModelAdmin):
    list_display = (
        "zone_code",
        "name",
        "is_active",
        "x_percent",
        "y_percent",
    )
    list_filter = ("is_active",)
    search_fields = ("zone_code", "name")


@admin.register(Bin)
class BinAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "collection_point",
        "station",
        "waste_type",
        "fill_level",
        "alert_level",
        "is_available",
        "hardware_id",
    )
    list_filter = (
        "collection_point",
        "station",
        "waste_type",
        "is_available",
    )
    search_fields = ("name", "hardware_id")
    readonly_fields = ("alert_level",)


@admin.register(DisposalSession)
class DisposalSessionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "visitor",
        "mode",
        "status",
        "bin",
        "created_at",
    )
    list_filter = ("mode", "status", "detected_waste")
    readonly_fields = ("id", "created_at")


@admin.register(PointEntry)
class PointEntryAdmin(admin.ModelAdmin):
    list_display = ("session", "points", "created_at")
    readonly_fields = ("created_at",)


@admin.register(HardwareJob)
class HardwareJobAdmin(admin.ModelAdmin):
    list_display = (
        "session",
        "station",
        "bin_number",
        "state",
        "created_at",
        "sent_at",
    )
    list_filter = ("station", "state")


class RouteStopInline(admin.TabularInline):
    model = RouteStop
    extra = 0


@admin.register(CollectionRoute)
class CollectionRouteAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "status",
        "created_by",
        "created_at",
        "started_at",
        "completed_at",
    )
    list_filter = ("status",)
    inlines = [RouteStopInline]