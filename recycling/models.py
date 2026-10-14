import uuid

from django.db import models
from django.db.models import Q


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


class Bin(models.Model):
    name = models.CharField(max_length=100)
    waste_type = models.CharField(
        max_length=20,
        choices=WasteType.choices,
        unique=True,
    )
    hardware_id = models.CharField(max_length=50, unique=True)
    is_available = models.BooleanField(default=True)

    def __str__(self):
        return self.name


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