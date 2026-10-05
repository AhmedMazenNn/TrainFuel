from django.db import transaction, IntegrityError
from django.db.models import Q, Max
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from accounts.models import User
from media_assets.models import Asset, AttachmentClaim
from media_assets.services import claim_asset
from sync.services import record_change
from .models import (Exercise, ExerciseText, Muscle, ExerciseMuscle, ExerciseMedia, Annotation,
                     WorkoutFolder, FolderOrder, FolderExercise, PlannedSet, ExerciseRecord, RecordedSet, CatalogAudit)
from .serializers import ExerciseInput, AnnotationInput, FolderInput, RecordInput


def accessible(user):
    return Exercise.objects.filter(Q(visibility="shared") | Q(visibility="private", owner=user), deleted_at__isnull=True)


def selected(user, entity_id, existing_id=None):
    row = accessible(user).select_for_update().filter(pk=entity_id).first()
    if not row or (row.archived_at and str(row.pk) != str(existing_id)):
        raise ValidationError({"exercise_id": "Exercise is unavailable for new selection."})
    return row


def set_data(row):
    return {"id": str(row.pk), "position": row.position, "weight_kg": str(row.weight_kg), "reps": row.reps}


def exercise_data(row):
    return {"id": str(row.pk), "revision": row.revision, "visibility": row.visibility, "category": row.category,
            "equipment": row.equipment, "archived": bool(row.archived_at),
            "translations": [{"language": t.language, "name": t.name, "instructions": t.instructions, "technique_notes": t.technique_notes} for t in row.texts.filter(deleted_at__isnull=True).order_by("language")],
            "muscles": [{"code": m.muscle.code, "role": m.role} for m in row.muscles.filter(deleted_at__isnull=True).select_related("muscle")],
            "media": [{"id": str(m.pk), "asset_id": str(m.asset_id), "position": m.position} for m in row.media.filter(deleted_at__isnull=True).order_by("position")]}


def annotation_data(row):
    return {"id": str(row.pk), "revision": row.revision, "exercise_id": str(row.exercise_id), "tutorial_url": row.tutorial_url, "notes": row.notes}


def folder_data(row):
    return {"id": str(row.pk), "revision": row.revision, "name": row.name, "position": row.position,
            "entries": [{"id": str(e.pk), "exercise_id": str(e.exercise_id), "position": e.position,
                         "sets": [set_data(s) for s in e.sets.filter(deleted_at__isnull=True).order_by("position")]} for e in row.entries.filter(deleted_at__isnull=True).order_by("position")]}


def record_data(row):
    return {"id": str(row.pk), "revision": row.revision, "exercise_id": str(row.exercise_id), "folder_exercise_id": str(row.folder_exercise_id) if row.folder_exercise_id else None,
            "local_date": row.local_date.isoformat(), "recorded_at": row.recorded_at.isoformat(), "kind": row.kind, "notes": row.notes,
            "sets": [set_data(s) for s in row.sets.filter(deleted_at__isnull=True).order_by("position")]}


def replace_sets(model, parent_field, parent, rows):
    now = timezone.now()
    children = model.objects.filter(**{parent_field: parent})
    children.update(deleted_at=now)
    for position, data in enumerate(rows, 1):
        child = model.objects.filter(pk=data["id"]).first()
        if child and getattr(child, parent_field + "_id") != parent.pk:
            raise ValidationError({"sets": "Set belongs to another aggregate."})
        if child:
            child.position, child.weight_kg, child.reps = position, data["weight_kg"], data["reps"]
            child.deleted_at = None
            child.revision += 1
            child.save()
        else:
            model.objects.create(**{parent_field: parent}, position=position, **data)


class AggregateAdapter:
    @classmethod
    def rows(cls, user):
        return cls.model.objects.filter(user=user, deleted_at__isnull=True)

    @classmethod
    def read(cls, user, entity_id):
        row = cls.rows(user).filter(pk=entity_id).first()
        return cls.serialize(row) if row else None

    @classmethod
    def snapshot(cls, user):
        return [{"entity_id": str(row.pk), "revision": row.revision, "data": cls.serialize(row)} for row in cls.rows(user)]

    @classmethod
    def apply(cls, user, operation):
        # Scope lock serializes same-owner ordering and uniqueness across different devices.
        User.objects.select_for_update().get(pk=user.pk)
        row = cls.model.objects.select_for_update().filter(pk=operation["entity_id"]).first()
        if row and not cls.authorized(user, row):
            return "rejected", {"code": "not_found"}
        if row and row.deleted_at:
            return "conflict", {"code": "entity_deleted"}
        create = operation["action"] == "create"
        if create and row:
            return "conflict", {"code": "revision_conflict", "revision": row.revision}
        if not create and not row:
            return "conflict", {"code": "entity_deleted"}
        if (row.revision if row else 0) != operation["base_revision"]:
            return "conflict", {"code": "revision_conflict", "revision": row.revision if row else 0}
        try:
            with transaction.atomic():
                if operation["action"] == "delete":
                    cls.remove(user, row)
                else:
                    serializer = cls.input(data=operation["payload"])
                    serializer.is_valid(raise_exception=True)
                    row = cls.write(user, row, operation["entity_id"], serializer.validated_data)
                scope = "catalog" if isinstance(row, Exercise) and row.visibility == "shared" else "owner"
                record_change(cls.entity_type, row.pk, row.revision, owner=None if scope == "catalog" else user, scope=scope, deleted=bool(row.deleted_at))
                return "accepted", {"revision": row.revision}
        except ValidationError as exc:
            return "rejected", {"code": "invalid_payload", "fields": list(exc.detail) if isinstance(exc.detail, dict) else []}
        except IntegrityError:
            return "conflict", {"code": "scope_conflict"}

    @staticmethod
    def authorized(user, row):
        return row.user_id == user.pk

    @staticmethod
    def remove(user, row):
        row.deleted_at = timezone.now()
        row.revision += 1
        row.save()


class ExerciseAdapter(AggregateAdapter):
    model, input, serialize, entity_type = Exercise, ExerciseInput, staticmethod(exercise_data), "exercise"

    @classmethod
    def rows(cls, user):
        return accessible(user)

    @staticmethod
    def authorized(user, row):
        return row.owner_id == user.pk if row.visibility == "private" else user.is_catalog_admin

    @staticmethod
    def write(user, row, entity_id, data):
        shared = data["visibility"] == "shared"
        if shared and not user.is_catalog_admin:
            raise ValidationError({"visibility": "Catalog administrator required."})
        if row and row.visibility != data["visibility"]:
            raise ValidationError({"visibility": "Visibility cannot be changed."})
        if not row:
            row = Exercise(id=entity_id, owner=None if shared else user, visibility=data["visibility"])
        else:
            row.revision += 1
        row.category, row.equipment = data["category"], data["equipment"]
        row.archived_at = (row.archived_at or timezone.now()) if data["archived"] else None
        row.save()
        row.texts.filter(deleted_at__isnull=True).update(deleted_at=timezone.now())
        for item in data["translations"]:
            ExerciseText.objects.create(exercise=row, **item)
        row.muscles.filter(deleted_at__isnull=True).update(deleted_at=timezone.now())
        for item in data["muscles"]:
            muscle = Muscle.objects.filter(code=item["code"], deleted_at__isnull=True).first()
            if not muscle:
                raise ValidationError({"muscles": "Unknown controlled muscle code."})
            ExerciseMuscle.objects.create(exercise=row, muscle=muscle, role=item["role"])
        previous = list(row.media.filter(deleted_at__isnull=True))
        kept = {item["id"] for item in data["media"]}
        for item in previous:
            if item.pk not in kept:
                AttachmentClaim.objects.filter(entity_type="exercise_media", entity_id=item.pk, deleted_at__isnull=True).update(deleted_at=timezone.now())
        row.media.filter(deleted_at__isnull=True).update(deleted_at=timezone.now())
        for position, item in enumerate(data["media"], 1):
            asset = Asset.objects.filter(pk=item["asset_id"], status="ready", deleted_at__isnull=True).first()
            if not asset or asset.visibility != ("public" if shared else "private"):
                raise ValidationError({"media": "Media visibility must match the exercise."})
            child = ExerciseMedia.objects.filter(pk=item["id"]).first()
            if child and (child.exercise_id != row.pk or child.asset_id != asset.pk):
                raise ValidationError({"media": "Attachment cannot be reassigned."})
            claim_asset(user, asset.pk, "exercise_media", item["id"], "exercise")
            if child:
                child.position, child.deleted_at = position, None
                child.revision += 1
                child.save()
            else:
                ExerciseMedia.objects.create(exercise=row, position=position, **item)
        if shared:
            CatalogAudit.objects.create(actor=user, exercise=row, action="update" if row.revision > 1 else "create", fields=sorted(data), revision=row.revision)
        return row

    @staticmethod
    def remove(user, row):
        # Referenced exercises are archived, never deleted out from under lifting history.
        if FolderExercise.objects.filter(exercise=row, deleted_at__isnull=True).exists() or ExerciseRecord.objects.filter(exercise=row, deleted_at__isnull=True).exists():
            raise ValidationError({"exercise": "Archive a referenced exercise instead."})
        AggregateAdapter.remove(user, row)
        AttachmentClaim.objects.filter(entity_type="exercise_media", entity_id__in=row.media.values("pk"), deleted_at__isnull=True).update(deleted_at=timezone.now())
        if row.visibility == "shared":
            CatalogAudit.objects.create(actor=user, exercise=row, action="delete", fields=[], revision=row.revision)


class AnnotationAdapter(AggregateAdapter):
    model, input, serialize, entity_type = Annotation, AnnotationInput, staticmethod(annotation_data), "exercise_annotation"

    @staticmethod
    def write(user, row, entity_id, data):
        exercise = selected(user, data["exercise_id"], row.exercise_id if row else None)
        if row and row.exercise_id != exercise.pk:
            raise ValidationError({"exercise_id": "Annotation exercise cannot change."})
        if not row:
            row = Annotation(id=entity_id, user=user, exercise=exercise)
        else:
            row.revision += 1
        row.tutorial_url, row.notes = data["tutorial_url"], data["notes"]
        row.save()
        return row


class FolderAdapter(AggregateAdapter):
    model, input, serialize, entity_type = WorkoutFolder, FolderInput, staticmethod(folder_data), "workout_folder"

    @staticmethod
    def write(user, row, entity_id, data):
        if not row:
            row = WorkoutFolder(id=entity_id, user=user)
            data = {**data, "position": (WorkoutFolder.objects.filter(user=user, deleted_at__isnull=True).aggregate(value=Max("position"))["value"] or 0) + 1}
        else:
            row.revision += 1
            if row.position != data["position"]:
                raise ValidationError({"position": "Use the atomic folder ordering operation."})
        row.name, row.position = data["name"], data["position"]
        row.save()
        # Stable reference-lock order prevents two owners selecting A/B and B/A deadlocking.
        list(accessible(user).select_for_update().filter(pk__in=[item["exercise_id"] for item in data["entries"]]).order_by("pk"))
        changed_contexts = []
        old = {e.pk: e for e in row.entries.all()}
        row.entries.filter(deleted_at__isnull=True).update(deleted_at=timezone.now())
        kept = {item["id"] for item in data["entries"]}
        for item in old.values():
            if item.pk not in kept:
                item.sets.filter(deleted_at__isnull=True).update(deleted_at=timezone.now())
                changed_contexts.extend(clear_context(item, emit=False))
        for position, item in enumerate(data["entries"], 1):
            entry = FolderExercise.objects.filter(pk=item["id"]).first()
            if entry and (entry.folder_id != row.pk or entry.exercise_id != item["exercise_id"]):
                raise ValidationError({"entries": "Entry cannot be reassigned."})
            exercise = selected(user, item["exercise_id"], entry.exercise_id if entry else None)
            if entry:
                entry.position, entry.deleted_at = position, None
                entry.revision += 1
                entry.save()
            else:
                entry = FolderExercise.objects.create(id=item["id"], folder=row, exercise=exercise, position=position)
            replace_sets(PlannedSet, "folder_exercise", entry, item["sets"])
        for record in changed_contexts:
            record_change("exercise_record", record.pk, record.revision, owner=record.user)
        return row

    @staticmethod
    def remove(user, row):
        AggregateAdapter.remove(user, row)
        for entry in row.entries.filter(deleted_at__isnull=True):
            clear_context(entry)
            entry.deleted_at = timezone.now()
            entry.save()
            entry.sets.filter(deleted_at__isnull=True).update(deleted_at=timezone.now())


def clear_context(entry, emit=True):
    changed = []
    for record in ExerciseRecord.objects.select_for_update().filter(folder_exercise=entry, deleted_at__isnull=True):
        record.folder_exercise = None
        record.revision += 1
        record.save()
        changed.append(record)
        if emit:
            record_change("exercise_record", record.pk, record.revision, owner=record.user)
    return changed


class RecordAdapter(AggregateAdapter):
    model, input, serialize, entity_type = ExerciseRecord, RecordInput, staticmethod(record_data), "exercise_record"

    @staticmethod
    def write(user, row, entity_id, data):
        exercise = selected(user, data["exercise_id"], row.exercise_id if row else None)
        context_id = data["folder_exercise_id"]
        if context_id:
            context = FolderExercise.objects.filter(pk=context_id, folder__user=user, folder__deleted_at__isnull=True, deleted_at__isnull=True, exercise=exercise).first()
            if not context:
                raise ValidationError({"folder_exercise_id": "Folder context is unavailable."})
        if not row:
            row = ExerciseRecord(id=entity_id, user=user)
        else:
            row.revision += 1
        for field in ["exercise_id", "folder_exercise_id", "local_date", "recorded_at", "kind", "notes"]:
            setattr(row, field, data[field])
        row.save()
        replace_sets(RecordedSet, "record", row, data["sets"])
        return row

    @staticmethod
    def remove(user, row):
        AggregateAdapter.remove(user, row)
        row.sets.filter(deleted_at__isnull=True).update(deleted_at=timezone.now())


class OrderAdapter:
    @staticmethod
    def read(user, entity_id):
        if str(entity_id) != str(user.pk):
            return None
        order = FolderOrder.objects.filter(user=user).first()
        return {"id": str(user.pk), "revision": order.revision if order else 1,
                "folders": [{"id": str(row.pk), "revision": row.revision, "position": row.position} for row in WorkoutFolder.objects.filter(user=user, deleted_at__isnull=True).order_by("position", "id")]}

    @staticmethod
    def snapshot(user):
        data = OrderAdapter.read(user, user.pk)
        return [{"entity_id": str(user.pk), "revision": data["revision"], "data": data}]

    @staticmethod
    def apply(user, operation):
        if str(operation["entity_id"]) != str(user.pk):
            return "rejected", {"code": "not_found"}
        if operation["action"] != "update":
            return "rejected", {"code": "unsupported_action"}
        User.objects.select_for_update().get(pk=user.pk)
        order, _ = FolderOrder.objects.get_or_create(user=user)
        items = operation["payload"].get("folders")
        if set(operation["payload"]) != {"folders"} or not isinstance(items, list) or any(not isinstance(i, dict) or set(i) != {"id", "revision"} for i in items):
            return "rejected", {"code": "invalid_payload"}
        rows = list(WorkoutFolder.objects.select_for_update().filter(user=user, deleted_at__isnull=True))
        by_id = {str(row.pk): row for row in rows}
        if len(items) != len(rows) or set(by_id) != {str(item["id"]) for item in items}:
            return "conflict", {"code": "scope_conflict"}
        if operation["base_revision"] != order.revision or any(type(item["revision"]) is not int or by_id[str(item["id"])].revision != item["revision"] for item in items):
            return "conflict", {"code": "revision_conflict", "revision": order.revision}
        for position, item in enumerate(items, 1):
            row = by_id[str(item["id"])]
            row.position, row.revision = position, row.revision + 1
            row.save()
        order.revision += 1
        order.save()
        for row in rows:
            record_change("workout_folder", row.pk, row.revision, owner=user)
        record_change("workout_order", user.pk, order.revision, owner=user)
        return "accepted", {"revision": order.revision}
