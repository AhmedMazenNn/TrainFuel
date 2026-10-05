import hashlib
import json
from django.db import connection, transaction
from django.db.models import Max
from django.utils import timezone
from rest_framework import serializers
from accounts.models import Profile
from accounts.serializers import ProfileSerializer, ProfileUpdateSerializer, StrictSerializer
from .models import ChangeRecord, Device, FeedState, Operation
from .registry import adapters

FEED_LOCK = 8473261901


def feed_lock(shared=False):
    # Serializes sequence allocation through commit: late commits cannot fall behind a cursor.
    if not connection.in_atomic_block:
        raise RuntimeError("Change feeds require an atomic transaction.")
    with connection.cursor() as cursor:
        cursor.execute("SELECT pg_advisory_xact_lock_shared(%s)" if shared else "SELECT pg_advisory_xact_lock(%s)", [FEED_LOCK])


def record_change(entity_type, entity_id, revision, *, owner=None, deleted=False, scope="owner"):
    feed_lock()
    return ChangeRecord.objects.create(entity_type=entity_type, entity_id=entity_id, entity_revision=revision, owner=owner, action="delete" if deleted else "upsert", scope=scope)


def highwater():
    return max(ChangeRecord.objects.aggregate(value=Max("sequence"))["value"] or 0, FeedState.objects.filter(pk=1).values_list("retention_floor", flat=True).first() or 0)


class ProfileAdapter:
    @staticmethod
    def read(user, entity_id):
        row = Profile.objects.filter(user=user, pk=entity_id, deleted_at__isnull=True).first()
        return ProfileSerializer(row).data if row else None

    @staticmethod
    def snapshot(user):
        row = Profile.objects.filter(user=user, deleted_at__isnull=True).first()
        return [{"entity_id": str(row.pk), "revision": row.revision, "data": ProfileSerializer(row).data}] if row else []

    @staticmethod
    def apply(user, operation):
        if str(operation["entity_id"]) != str(user.pk):
            return "rejected", {"code": "not_found"}
        row = Profile.objects.select_for_update().filter(user=user).first()
        if not row or row.deleted_at:
            return "conflict", {"code": "entity_deleted"}
        if operation["action"] != "update":
            return "rejected", {"code": "unsupported_action"}
        if row.revision != operation["base_revision"]:
            return "conflict", {"code": "revision_conflict", "revision": row.revision}
        serializer = ProfileUpdateSerializer(data={**operation["payload"], "revision": operation["base_revision"]})
        if "revision" in operation["payload"]:
            return "rejected", {"code": "invalid_payload"}
        if not serializer.is_valid():
            return "rejected", {"code": "invalid_payload", "fields": list(serializer.errors)}
        fields = dict(serializer.validated_data)
        fields.pop("revision")
        for key, value in fields.items():
            setattr(row, key, value)
        row.revision += 1
        row.save(update_fields=[*fields, "revision", "updated_at"])
        record_change("profile", row.pk, row.revision, owner=user)
        return "accepted", {"revision": row.revision}


class OperationSerializer(StrictSerializer):
    idempotency_key = serializers.UUIDField()
    entity_type = serializers.CharField(max_length=80)
    entity_id = serializers.UUIDField()
    action = serializers.ChoiceField(choices=["create", "update", "delete"])
    base_revision = serializers.IntegerField(min_value=0)
    payload = serializers.DictField(default=dict)


def replay(user, device_id, operations):
    output = []
    for operation in operations:
        fingerprint = hashlib.sha256(json.dumps(operation, sort_keys=True, default=str, separators=(",", ":")).encode()).hexdigest()
        with transaction.atomic():
            device = Device.objects.select_for_update().get(pk=device_id, user=user)
            # Global key lock also protects retries submitted under a different owned device.
            key_lock = int.from_bytes(operation["idempotency_key"].bytes[:4], "big", signed=True)
            with connection.cursor() as cursor:
                # Separate two-int namespace prevents client UUIDs colliding with feed locks.
                cursor.execute("SELECT pg_advisory_xact_lock(%s, %s)", [8484, key_lock])
            receipt = Operation.objects.select_related("device").filter(idempotency_key=operation["idempotency_key"]).first()
            adapter = adapters.get(operation["entity_type"])
            if receipt:
                if receipt.device.user_id != user.pk or receipt.request_hash != fingerprint:
                    output.append({"idempotency_key": str(operation["idempotency_key"]), "status": "rejected", "code": "idempotency_key_reused"})
                    continue
            else:
                if adapter:
                    status, result = adapter.apply(user, operation)
                else:
                    status, result = "rejected", {"code": "unsupported_entity"}
                receipt = Operation.objects.create(device=device, request_hash=fingerprint, status=status, result=result, **{k: v for k, v in operation.items() if k != "payload"})
            current = adapter.read(user, operation["entity_id"]) if adapter else None
            output.append({"idempotency_key": str(receipt.idempotency_key), "status": receipt.status, **receipt.result, "current": current})
            Device.objects.filter(pk=device.pk).update(last_seen_at=timezone.now())
    return output
