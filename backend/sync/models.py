import uuid
from django.conf import settings
from django.db import models
from django.db.models import Q


class Device(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    platform = models.CharField(max_length=10, default="web", choices=[("web", "web"), ("android", "android"), ("ios", "ios")])
    last_ack_sequence = models.PositiveBigIntegerField(default=0)
    last_seen_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.CheckConstraint(condition=Q(platform__in=["web", "android", "ios"]), name="sync_device_platform")]


class Operation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    device = models.ForeignKey(Device, on_delete=models.PROTECT)
    idempotency_key = models.UUIDField(unique=True)
    request_hash = models.CharField(max_length=64)
    entity_type = models.CharField(max_length=80)
    entity_id = models.UUIDField()
    action = models.CharField(max_length=10)
    base_revision = models.PositiveBigIntegerField()
    status = models.CharField(max_length=10, choices=[("accepted", "accepted"), ("conflict", "conflict"), ("rejected", "rejected")])
    result = models.JSONField(default=dict)  # Receipt metadata only; never a copy of private payloads.
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.CheckConstraint(condition=Q(action__in=["create", "update", "delete"]), name="sync_operation_action"), models.CheckConstraint(condition=Q(status__in=["accepted", "conflict", "rejected"]), name="sync_operation_status")]


class ChangeRecord(models.Model):
    sequence = models.BigAutoField(primary_key=True)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.PROTECT)
    entity_type = models.CharField(max_length=80)
    entity_id = models.UUIDField()
    entity_revision = models.PositiveBigIntegerField()
    action = models.CharField(max_length=10, choices=[("upsert", "upsert"), ("delete", "delete")])
    scope = models.CharField(max_length=10, choices=[("owner", "owner"), ("catalog", "catalog")])
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["owner", "sequence"])]
        constraints = [models.CheckConstraint(condition=(Q(scope="owner", owner__isnull=False) | Q(scope="catalog", owner__isnull=True)), name="change_scope_owner"), models.CheckConstraint(condition=Q(entity_revision__gte=1), name="change_revision_positive"), models.CheckConstraint(condition=Q(action__in=["upsert", "delete"]), name="change_action_valid")]


class FeedState(models.Model):
    id = models.PositiveSmallIntegerField(primary_key=True, default=1)
    retention_floor = models.PositiveBigIntegerField(default=0)
