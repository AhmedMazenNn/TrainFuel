"""Called by the account lifecycle boundary inside its owner-locked transaction."""
from django.utils import timezone
from datetime import date, datetime, timezone as datetime_timezone
from media_assets.models import AttachmentClaim
from sync.services import record_change
from .models import ExerciseText, ExerciseMuscle, ExerciseMedia, FolderExercise, PlannedSet, RecordedSet
from .services import ExerciseAdapter, AnnotationAdapter, FolderAdapter, RecordAdapter


def export_data(user):
    return {"exercises": [ExerciseAdapter.serialize(row) for row in ExerciseAdapter.rows(user).filter(owner=user)],
            "annotations": [AnnotationAdapter.serialize(row) for row in AnnotationAdapter.rows(user)],
            "folders": [FolderAdapter.serialize(row) for row in FolderAdapter.rows(user)],
            "records": [RecordAdapter.serialize(row) for row in RecordAdapter.rows(user)]}


def erase_data(user):
    now = timezone.now()
    exercises = list(ExerciseAdapter.model.objects.select_for_update().filter(owner=user))
    folders = list(FolderAdapter.model.objects.select_for_update().filter(user=user))
    records = list(RecordAdapter.model.objects.select_for_update().filter(user=user))
    annotations = list(AnnotationAdapter.model.objects.select_for_update().filter(user=user))
    media_ids = ExerciseMedia.objects.filter(exercise__owner=user).values_list("id", flat=True)
    AttachmentClaim.objects.filter(entity_type="exercise_media", entity_id__in=media_ids, deleted_at__isnull=True).update(deleted_at=now)
    RecordedSet.objects.filter(record__user=user).delete()
    for row in records:
        row.folder_exercise = None
    PlannedSet.objects.filter(folder_exercise__folder__user=user).delete()
    FolderExercise.objects.filter(folder__user=user).delete()
    ExerciseText.objects.filter(exercise__owner=user).delete()
    ExerciseMuscle.objects.filter(exercise__owner=user).delete()
    ExerciseMedia.objects.filter(exercise__owner=user).delete()
    for adapter, rows in [(RecordAdapter, records), (FolderAdapter, folders), (AnnotationAdapter, annotations), (ExerciseAdapter, exercises)]:
        for row in rows:
            row.deleted_at, row.revision = now, row.revision + 1
            if hasattr(row, "notes"):
                row.notes = ""
            if hasattr(row, "tutorial_url"):
                row.tutorial_url = ""
            if hasattr(row, "name"):
                row.name = ""
            if hasattr(row, "position"):
                row.position = 1
            if hasattr(row, "local_date"):
                row.local_date = date(1970, 1, 1)
                row.recorded_at = datetime(1970, 1, 1, tzinfo=datetime_timezone.utc)
                row.kind = "reference"
            if hasattr(row, "category"):
                row.category, row.equipment, row.archived_at = "strength", "other", None
            row.save()
            record_change(adapter.entity_type, row.pk, row.revision, owner=user, deleted=True)
    # Only UUIDs, relationships, neutral placeholders and deletion timestamps remain in inaccessible tombstones.
    # CatalogAudit contains action/field names only; shared exercises belong to the catalog, not actor.
