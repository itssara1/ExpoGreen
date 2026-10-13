from django.contrib import admin

from .models import Bin, DisposalSession, PointEntry, Visitor


@admin.register(Visitor)
class VisitorAdmin(admin.ModelAdmin):
    list_display = ("ticket_code", "points_balance", "created_at")
    search_fields = ("ticket_code",)


@admin.register(Bin)
class BinAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "waste_type",
        "hardware_id",
        "is_available",
    )
    list_filter = ("waste_type", "is_available")


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