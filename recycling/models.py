import uuid

from django.db import models
from django.db.models import Q
from django.conf import settings as django_settings
from django.utils import timezone


class WasteType(models.TextChoices):
    PLASTIC = "plastic", "Plastic"
    ALUMINUM = "aluminum", "Aluminum"
    PAPER = "paper", "Paper"
    NON_RECYCLABLE = "non_recyclable", "Non-recyclable"
    MIXED = "mixed", "Mixed / Unknown"


class Visitor(models.Model):
    ticket_code = models.CharField(max_length=100, unique=True)
    name = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def points_balance(self):
        return PointEntry.objects.filter(
            session__visitor=self
        ).aggregate(total=models.Sum("points"))["total"] or 0

    def __str__(self):
        return self.name or self.ticket_code

class CollectionPoint(models.Model):
    name = models.CharField(max_length=120)
    zone_code = models.CharField(max_length=30, unique=True)
    description = models.CharField(max_length=200, blank=True)

    # إحداثيات على الخريطة (بالنسبة المئوية)
    x_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=50,
    )
    y_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=50,
    )

    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["zone_code"]

    def __str__(self):
        return f"{self.zone_code} - {self.name}"

class Bin(models.Model):
    station = models.CharField(
        max_length=30,
        default="main",
    )

    collection_point = models.ForeignKey(
        CollectionPoint,
        on_delete=models.PROTECT,
        related_name="bins",
        null=True,
        blank=True,
    )

    name = models.CharField(max_length=100)

    waste_type = models.CharField(
        max_length=20,
        choices=WasteType.choices,
    )

    hardware_id = models.CharField(max_length=50, unique=True)
    is_available = models.BooleanField(default=True)

    fill_level = models.PositiveSmallIntegerField(default=0)
    last_level_updated_at = models.DateTimeField(
        null=True,
        blank=True,
    )
    last_emptied_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["collection_point__zone_code", "name"]
        constraints = [
            models.UniqueConstraint(
                fields=["station", "waste_type"],
                name="unique_station_waste_type",
            ),
            models.CheckConstraint(
                condition=Q(fill_level__gte=0) & Q(fill_level__lte=100),
                name="bin_fill_level_between_0_and_100",
            ),
        ]

    def __str__(self):
        point = self.collection_point.zone_code if self.collection_point else "NoPoint"
        return f"{point} - {self.name}"

    @property
    def alert_level(self):
        if self.fill_level >= 90:
            return "full"
        if self.fill_level >= 70:
            return "warning"
        return "normal"

    @property
    def alert_label(self):
        if self.fill_level >= 90:
            return "ممتلئة"
        if self.fill_level >= 70:
            return "قريبة من الامتلاء"
        return "طبيعية"

    @property
    def needs_collection(self):
        return self.fill_level >= 70
    
class DisposalSession(models.Model):
    class Mode(models.TextChoices):
        SORT = "sort", "Sort and earn"
        QUICK = "quick", "Quick disposal"

    class Status(models.TextChoices):
        STARTED = "started", "Started"
        CLASSIFIED = "classified", "Classified"
        WAITING = "waiting", "Waiting for disposal"
        COMPLETED = "completed", "Completed"
        EXPIRED = "expired", "Expired"
        FAILED = "failed", "Failed"

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    visitor = models.ForeignKey(
        Visitor,
        on_delete=models.PROTECT,
        related_name="disposal_sessions",
        null=True,
        blank=True,
    )
    mode = models.CharField(
        max_length=10,
        choices=Mode.choices,
        default=Mode.SORT,
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.STARTED,
    )
    detected_waste = models.CharField(
        max_length=20,
        choices=WasteType.choices,
        blank=True,
    )
    bin = models.ForeignKey(
        Bin,
        on_delete=models.PROTECT,
        related_name="disposal_sessions",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    disposal_confirmed_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.CheckConstraint(
                condition=Q(mode="quick") | Q(visitor__isnull=False),
                name="sorting_session_requires_visitor",
            ),
        ]

    def __str__(self):
        return f"{self.id} - {self.status}"


class PointEntry(models.Model):
    session = models.OneToOneField(
        DisposalSession,
        on_delete=models.PROTECT,
        related_name="point_entry",
    )
    points = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.points} points - {self.session_id}"


class HardwareJob(models.Model):
    session = models.OneToOneField(
        DisposalSession,
        on_delete=models.PROTECT,
        related_name="hardware_job",
    )
    station = models.CharField(
        max_length=30,
        default="main",
    )
    bin_number = models.PositiveSmallIntegerField()
    state = models.CharField(
        max_length=20,
        default="queued",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(
        null=True,
        blank=True,
    )
    error = models.CharField(
        max_length=250,
        blank=True,
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["station"],
                condition=Q(
                    state__in=[
                        "queued",
                        "sent",
                        "opened",
                        "armed",
                    ]
                ),
                name="one_active_hardware_job_per_station",
            ),
            models.CheckConstraint(
                condition=Q(bin_number__in=[1, 2]),
                name="hardware_bin_is_one_or_two",
            ),
        ]

class CollectionRoute(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        ACTIVE = "active", "Active"
        COMPLETED = "completed", "Completed"

    title = models.CharField(max_length=120)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
    )
    created_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="collection_routes",
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title


class RouteStop(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        SERVICED = "serviced", "Serviced"
        SKIPPED = "skipped", "Skipped"

    route = models.ForeignKey(
        CollectionRoute,
        on_delete=models.CASCADE,
        related_name="stops",
    )
    bin = models.ForeignKey(
        Bin,
        on_delete=models.PROTECT,
        related_name="route_stops",
    )
    stop_order = models.PositiveSmallIntegerField()
    fill_snapshot = models.PositiveSmallIntegerField(default=0)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["stop_order"]
        constraints = [
            models.UniqueConstraint(
                fields=["route", "stop_order"],
                name="unique_route_stop_order",
            ),
            models.UniqueConstraint(
                fields=["route", "bin"],
                name="unique_route_bin_once",
            ),
        ]

    def __str__(self):
        return f"{self.route.title} - stop {self.stop_order}"