from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from accounts.models import User
from media_assets.models import Asset, AttachmentClaim
from media_assets.services import claim_asset, cleanup_key, changed
from sync.services import record_change
from .models import WeightEntry, ProgressWeek, ProgressPhoto, Reminder
from .serializers import WeightInput, PhotoInput, ReminderInput


def serialize(row):
    data = {"id": str(row.pk), "revision": row.revision}
    if isinstance(row, WeightEntry):
        data.update(
            local_date=row.local_date.isoformat(),
            weight_kg=str(row.weight_kg),
            notes=row.notes,
        )
    elif isinstance(row, Reminder):
        data.update(
            category=row.category,
            local_time=row.local_time.isoformat(),
            weekdays=row.weekdays,
            enabled=row.enabled,
        )
    else:
        data.update(
            week_start=row.week.week_start.isoformat(),
            asset_id=str(row.asset_id),
            slot=row.slot,
            capture_date=row.capture_date.isoformat(),
            label=row.label,
            notes=row.notes,
        )
    return data


def retire_asset(asset_id, photo_id):
    AttachmentClaim.objects.filter(
        asset_id=asset_id,
        entity_type="progress_photo",
        entity_id=photo_id,
        deleted_at__isnull=True,
    ).update(deleted_at=timezone.now())
    asset = Asset.objects.select_for_update().get(pk=asset_id)
    asset.deleted_at = timezone.now()
    asset.status = "deleted"
    asset.revision += 1
    asset.save()
    cleanup_key(asset.object_key, asset.visibility)
    cleanup_key(asset.thumbnail_key, asset.visibility)
    changed(asset)


class Adapter:
    model = None
    serializer = None
    entity_type = None

    @classmethod
    def owned(cls, user):
        return cls.model.objects.filter(
            **({"week__user": user} if cls.model is ProgressPhoto else {"user": user})
        )

    @classmethod
    def read(cls, user, entity_id):
        row = cls.owned(user).filter(pk=entity_id, deleted_at__isnull=True).first()
        return serialize(row) if row else None

    @classmethod
    def snapshot(cls, user):
        return [
            {"entity_id": str(row.pk), "revision": row.revision, "data": serialize(row)}
            for row in cls.owned(user).filter(deleted_at__isnull=True)
        ]

    @classmethod
    def apply(cls, user, operation):
        # Owner lock serializes absent-row date/week allocation and cross-week moves.
        User.objects.select_for_update().get(pk=user.pk)
        row = (
            cls.owned(user)
            .select_for_update()
            .filter(pk=operation["entity_id"])
            .first()
        )
        action = operation["action"]
        base = operation["base_revision"]
        if row and row.deleted_at:
            return "conflict", {"code": "entity_deleted"}
        if row and (action == "create" or base != row.revision):
            return "conflict", {"code": "revision_conflict", "revision": row.revision}
        if not row and (action != "create" or base != 0):
            return "rejected", {"code": "not_found"}
        if not row and cls.model.objects.filter(pk=operation["entity_id"]).exists():
            return "rejected", {"code": "not_found"}
        if action == "delete":
            if operation["payload"]:
                return "rejected", {"code": "invalid_payload"}
            row.deleted_at = timezone.now()
            row.revision += 1
            row.save()
            if cls.model is ProgressPhoto:
                retire_asset(row.asset_id, row.pk)
            record_change(
                cls.entity_type, row.pk, row.revision, owner=user, deleted=True
            )
            return "accepted", {"revision": row.revision}
        serializer = cls.serializer(data=operation["payload"])
        if not serializer.is_valid():
            return "rejected", {
                "code": "invalid_payload",
                "fields": list(serializer.errors),
            }
        data = dict(serializer.validated_data)
        if cls.model is WeightEntry:
            if (
                cls.owned(user)
                .filter(local_date=data["local_date"], deleted_at__isnull=True)
                .exclude(pk=operation["entity_id"])
                .exists()
            ):
                return "conflict", {"code": "date_already_recorded"}
        if cls.model is ProgressPhoto:
            week, _ = ProgressWeek.objects.get_or_create(
                user=user, week_start=data.pop("week_start"), deleted_at=None
            )
            week = ProgressWeek.objects.select_for_update().get(pk=week.pk)
            used = set(
                ProgressPhoto.objects.filter(week=week, deleted_at__isnull=True)
                .exclude(pk=operation["entity_id"])
                .values_list("slot", flat=True)
            )
            slot = (
                row.slot
                if row and row.week_id == week.pk
                else next((s for s in range(1, 5) if s not in used), None)
            )
            if slot is None:
                return "conflict", {"code": "week_full"}
            asset_id = data.pop("asset_id")
            asset = Asset.objects.filter(
                pk=asset_id,
                owner=user,
                visibility="private",
                status="ready",
                deleted_at__isnull=True,
            ).first()
            if not asset:
                return "rejected", {"code": "asset_unavailable"}
            try:
                with transaction.atomic():
                    claim_asset(
                        user,
                        asset_id,
                        "progress_photo",
                        operation["entity_id"],
                        "progress",
                    )
            except ValidationError as exc:
                return "rejected", {
                    "code": str(exc.detail.get("code", "asset_unavailable"))
                }
            if row and row.asset_id != asset_id:
                retire_asset(row.asset_id, row.pk)
            data.update(week=week, slot=slot, asset_id=asset_id)
        if not row:
            row = cls.model(
                id=operation["entity_id"],
                **({} if cls.model is ProgressPhoto else {"user": user})
            )
        else:
            row.revision += 1
        for key, value in data.items():
            setattr(row, key, value)
        row.save()
        record_change(cls.entity_type, row.pk, row.revision, owner=user)
        return "accepted", {"revision": row.revision}


class WeightAdapter(Adapter):
    model = WeightEntry
    serializer = WeightInput
    entity_type = "weight_entry"


class PhotoAdapter(Adapter):
    model = ProgressPhoto
    serializer = PhotoInput
    entity_type = "progress_photo"


class ReminderAdapter(Adapter):
    model = Reminder
    serializer = ReminderInput
    entity_type = "reminder"
