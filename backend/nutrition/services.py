import uuid
from datetime import date
from decimal import Decimal
from zoneinfo import ZoneInfo
from django.db import connection
from django.utils import timezone
from accounts.models import User
from sync.services import record_change
from .models import NutritionTarget, NutritionDay, FoodEntry, NUTRIENTS, TARGETS
from .serializers import (
    TargetSerializer,
    DaySerializer,
    FoodSerializer,
    TargetInput,
    DayInput,
    FoodInput,
)


def today(user):
    return timezone.now().astimezone(ZoneInfo(user.profile.timezone)).date()


def scope_lock(user):
    # Independent namespace; serialize same-owner unique-date creations and cross-day moves.
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT pg_advisory_xact_lock(%s,%s)",
            [4413, int.from_bytes(user.pk.bytes[:4], "big", signed=True)],
        )


class Adapter:
    @classmethod
    def owned(cls, user):
        return cls.model.objects.filter(**{cls.owner_field: user})

    @classmethod
    def read(cls, user, entity_id):
        row = cls.owned(user).filter(pk=entity_id, deleted_at__isnull=True).first()
        return dict(cls.output(row).data) if row else None

    @classmethod
    def snapshot(cls, user):
        return [
            {
                "entity_id": str(row.pk),
                "revision": row.revision,
                "data": dict(cls.output(row).data),
            }
            for row in cls.owned(user).filter(deleted_at__isnull=True)
        ]

    @classmethod
    def apply(cls, user, op):
        scope_lock(user)
        with connection.cursor() as cursor:
            entity_id = op["entity_id"]
            key = uuid.UUID(str(entity_id))
            cursor.execute(
                "SELECT pg_advisory_xact_lock(%s,%s)",
                [4414, int.from_bytes(key.bytes[:4], "big", signed=True)],
            )
        row = cls.owned(user).select_for_update().filter(pk=op["entity_id"]).first()
        if row and row.deleted_at:
            return "conflict", {"code": "entity_deleted"}
        if op["action"] == "create":
            if row:
                return "conflict", {
                    "code": "revision_conflict",
                    "revision": row.revision,
                }
            if op["base_revision"] != 0:
                return "rejected", {"code": "invalid_revision"}
            # A UUID owned by another account is never disclosed or reassigned.
            if cls.model.objects.filter(pk=op["entity_id"]).exists():
                return "rejected", {"code": "not_found"}
        else:
            if not row:
                return "rejected", {"code": "not_found"}
            if row.revision != op["base_revision"]:
                return "conflict", {
                    "code": "revision_conflict",
                    "revision": row.revision,
                }
        if op["action"] == "delete":
            if op["payload"]:
                return "rejected", {"code": "invalid_payload"}
            if cls is DayAdapter:
                # Day removal explicitly tombstones its entries; no invisible retained intake.
                for entry in row.entries.filter(deleted_at__isnull=True):
                    entry.deleted_at = timezone.now()
                    entry.revision += 1
                    entry.save()
                    record_change(
                        "food_entry", entry.pk, entry.revision, owner=user, deleted=True
                    )
            row.deleted_at = timezone.now()
            row.revision += 1
            row.save()
            record_change(
                cls.entity_type, row.pk, row.revision, owner=user, deleted=True
            )
            return "accepted", {"revision": row.revision}
        serializer = cls.input(data=op["payload"])
        if not serializer.is_valid():
            return "rejected", {
                "code": "invalid_payload",
                "fields": list(serializer.errors),
            }
        fields = dict(serializer.validated_data)
        if cls is DayAdapter:
            if fields["local_date"] > today(user):
                return "rejected", {"code": "future_day"}
            if row and fields["local_date"] != row.local_date:
                return "rejected", {"code": "immutable_day_date"}
            if not row:
                canonical = (
                    cls.owned(user)
                    .filter(local_date=fields["local_date"], deleted_at__isnull=True)
                    .first()
                )
                if canonical:
                    return "accepted", {
                        "canonical_id": str(canonical.pk),
                        "revision": canonical.revision,
                    }
                target = (
                    NutritionTarget.objects.filter(
                        user=user,
                        deleted_at__isnull=True,
                        effective_date__lte=fields["local_date"],
                    )
                    .order_by("-effective_date")
                    .first()
                )
                if fields.get("source_target") is not None:
                    target = NutritionTarget.objects.filter(
                        pk=fields["source_target"], user=user, deleted_at__isnull=True
                    ).first()
                    if not target or target.effective_date > fields["local_date"]:
                        return "rejected", {"code": "invalid_target"}
                fields["source_target"] = target
                fields.setdefault(
                    "goal_snapshot", target.goal if target else user.profile.goal
                )
                for source, dest in zip(NUTRIENTS, TARGETS):
                    fields.setdefault(dest, getattr(target, source) if target else None)
            elif "source_target" in fields:
                # Historical snapshots are deliberately edited, not refreshed from source changes.
                if fields["source_target"] is not None:
                    target = NutritionTarget.objects.filter(
                        pk=fields["source_target"], user=user
                    ).first()
                    if not target or (
                        target.deleted_at and row.source_target_id != target.pk
                    ):
                        return "rejected", {"code": "invalid_target"}
                    fields["source_target"] = target
        elif cls is TargetAdapter:
            duplicate = cls.owned(user).filter(
                effective_date=fields["effective_date"], deleted_at__isnull=True
            )
            if row:
                duplicate = duplicate.exclude(pk=row.pk)
            if duplicate.exists():
                return "conflict", {"code": "effective_date_exists"}
        elif cls is FoodAdapter:
            day = NutritionDay.objects.filter(
                pk=fields["day"], user=user, deleted_at__isnull=True
            ).first()
            if not day:
                return "rejected", {"code": "invalid_day"}
            fields["day"] = day
        if row:
            for key, value in fields.items():
                setattr(row, key, value)
            row.revision += 1
            row.save()
        else:
            if cls is not FoodAdapter:
                fields["user"] = user
            row = cls.model.objects.create(id=op["entity_id"], **fields)
        record_change(cls.entity_type, row.pk, row.revision, owner=user)
        return "accepted", {"revision": row.revision}


class TargetAdapter(Adapter):
    model = NutritionTarget
    output = TargetSerializer
    input = TargetInput
    owner_field = "user"
    entity_type = "nutrition_target"


class DayAdapter(Adapter):
    model = NutritionDay
    output = DaySerializer
    input = DayInput
    owner_field = "user"
    entity_type = "nutrition_day"


class FoodAdapter(Adapter):
    model = FoodEntry
    output = FoodSerializer
    input = FoodInput
    owner_field = "day__user"
    entity_type = "food_entry"


def counters(day):
    entries = list(day.entries.filter(deleted_at__isnull=True))
    result = {}
    for nutrient, target in zip(NUTRIENTS, TARGETS):
        consumed = sum(
            (getattr(e, nutrient) or Decimal(0) for e in entries), Decimal(0)
        )
        target_value = getattr(day, target)
        result[nutrient] = {
            "consumed": str(consumed),
            "target": str(target_value) if target_value is not None else None,
            "remaining": (
                str(target_value - consumed) if target_value is not None else None
            ),
            "partial": any(getattr(e, nutrient) is None for e in entries),
            "observed": bool(entries),
        }
    return result
