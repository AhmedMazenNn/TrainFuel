"""Account lifecycle hooks; invoke erase_data in the caller's atomic transaction."""

from datetime import timedelta
from django.utils import timezone
from sync.services import record_change
from media_assets.models import AttachmentClaim
from .models import WeightEntry, ProgressPhoto, ProgressWeek, Reminder
from .services import serialize


def export_data(user):
    return {
        "weights": [
            serialize(r)
            for r in WeightEntry.objects.filter(user=user, deleted_at__isnull=True)
        ],
        "photos": [
            serialize(r)
            for r in ProgressPhoto.objects.filter(
                week__user=user, deleted_at__isnull=True
            )
        ],
        "reminders": [
            serialize(r)
            for r in Reminder.objects.filter(user=user, deleted_at__isnull=True)
        ],
    }


def erase_data(user):
    now = timezone.now()
    for model, kind, filters in [
        (WeightEntry, "weight_entry", {"user": user}),
        (ProgressPhoto, "progress_photo", {"week__user": user}),
        (Reminder, "reminder", {"user": user}),
    ]:
        for row in model.objects.select_for_update().filter(**filters):
            row.deleted_at = now
            row.revision += 1
            if model is WeightEntry:
                row.notes = ""
                row.local_date = now.date()
                row.weight_kg = "0.001"
            if model is ProgressPhoto:
                row.label = ""
                row.notes = ""
                row.capture_date = now.date()
                AttachmentClaim.objects.filter(
                    entity_type="progress_photo",
                    entity_id=row.pk,
                    deleted_at__isnull=True,
                ).update(deleted_at=now)
            if model is Reminder:
                row.enabled = False
                row.weekdays = [1]
                row.local_time = "00:00"
                row.category = "weight"
            row.save()
            record_change(kind, row.pk, row.revision, owner=user, deleted=True)
    for week in ProgressWeek.objects.filter(user=user):
        week.deleted_at = now
        week.week_start = now.date() - timedelta(days=now.date().weekday())
        week.revision += 1
        week.save()
