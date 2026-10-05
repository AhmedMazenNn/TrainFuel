import uuid
from django.conf import settings
from django.db import models
from django.db.models import Q
from django.contrib.postgres.fields import ArrayField


class Record(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    revision = models.PositiveBigIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True)

    class Meta:
        abstract = True


class WeightEntry(Record):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    local_date = models.DateField()
    weight_kg = models.DecimalField(max_digits=12, decimal_places=3)
    notes = models.TextField(blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "local_date"],
                condition=Q(deleted_at__isnull=True),
                name="progress_weight_active_date",
            ),
            models.CheckConstraint(
                condition=Q(weight_kg__gt=0), name="progress_weight_positive"
            ),
        ]


class ProgressWeek(Record):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    week_start = models.DateField()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "week_start"],
                condition=Q(deleted_at__isnull=True),
                name="progress_week_active_start",
            )
        ]


class ProgressPhoto(Record):
    week = models.ForeignKey(ProgressWeek, on_delete=models.PROTECT)
    asset = models.ForeignKey("media_assets.Asset", on_delete=models.PROTECT)
    slot = models.PositiveSmallIntegerField()
    capture_date = models.DateField()
    label = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=Q(slot__gte=1, slot__lte=4), name="progress_photo_slot_range"
            ),
            models.UniqueConstraint(
                fields=["week", "slot"],
                condition=Q(deleted_at__isnull=True),
                name="progress_photo_active_slot",
            ),
            models.UniqueConstraint(
                fields=["asset"],
                condition=Q(deleted_at__isnull=True),
                name="progress_photo_active_asset",
            ),
        ]


class Reminder(Record):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    category = models.CharField(max_length=10)
    local_time = models.TimeField()
    weekdays = ArrayField(models.PositiveSmallIntegerField(), size=7)
    enabled = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=Q(category__in=["food", "exercise", "weight", "photo"]),
                name="progress_reminder_category",
            ),
            models.CheckConstraint(
                condition=Q(weekdays__contained_by=[1, 2, 3, 4, 5, 6, 7]),
                name="progress_reminder_days",
            ),
        ]
