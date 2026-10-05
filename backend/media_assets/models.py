import uuid
from django.conf import settings
from django.db import models
from django.db.models import Q


class Asset(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.PROTECT)
    visibility = models.CharField(max_length=10, default="private", choices=[("private", "private"), ("public", "public")])
    object_key = models.CharField(max_length=255, unique=True)
    thumbnail_key = models.CharField(max_length=255, blank=True)
    mime_type = models.CharField(max_length=100, blank=True)
    byte_size = models.PositiveBigIntegerField(default=0)
    status = models.CharField(max_length=10, default="processing", choices=[("processing", "processing"), ("ready", "ready"), ("deleted", "deleted")])
    source_url = models.URLField(blank=True)
    license = models.CharField(max_length=255, blank=True)
    revision = models.PositiveBigIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True)

    class Meta:
        constraints = [models.CheckConstraint(condition=Q(visibility="private", owner__isnull=False) | Q(visibility="public", owner__isnull=True), name="asset_visibility_owner"), models.CheckConstraint(condition=Q(revision__gte=1), name="asset_revision_positive"), models.CheckConstraint(condition=Q(status__in=["processing", "ready", "deleted"]), name="asset_status_valid"), models.CheckConstraint(condition=~Q(status="ready") | Q(byte_size__gt=0), name="ready_asset_has_bytes")]


class Upload(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    asset = models.OneToOneField(Asset, on_delete=models.PROTECT)
    purpose = models.CharField(max_length=10, choices=[("exercise", "exercise"), ("progress", "progress")])
    status = models.CharField(max_length=10, default="pending", choices=[("pending", "pending"), ("finalized", "finalized"), ("failed", "failed")])
    staging_key = models.CharField(max_length=255, blank=True)
    expires_at = models.DateTimeField()
    error_code = models.CharField(max_length=80, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.CheckConstraint(condition=Q(purpose__in=["exercise", "progress"]), name="upload_purpose_valid"), models.CheckConstraint(condition=Q(status__in=["pending", "finalized", "failed"]), name="upload_status_valid")]


class AttachmentClaim(models.Model):
    """Cross-domain exclusivity: exercise and progress-photo services MUST use claim_asset."""
    asset = models.ForeignKey(Asset, on_delete=models.PROTECT)
    entity_type = models.CharField(max_length=80)
    entity_id = models.UUIDField()
    deleted_at = models.DateTimeField(null=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["asset"], condition=Q(deleted_at__isnull=True), name="asset_one_active_attachment")]


class CleanupTask(models.Model):
    key = models.CharField(max_length=255)
    visibility = models.CharField(max_length=10)
    created_at = models.DateTimeField(auto_now_add=True)
    attempts = models.PositiveIntegerField(default=0)
