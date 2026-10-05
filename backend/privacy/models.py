import uuid
from django.conf import settings
from django.db import models
from django.db.models import Q


class PrivacyJob(models.Model):
    class Kind(models.TextChoices):
        EXPORT = "export", "Personal data export"
        DELETE = "delete", "Account deletion"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        RUNNING = "running", "Running"
        READY = "ready", "Ready"
        FAILED = "failed", "Failed"
        CANCELLED = "cancelled", "Cancelled"
        EXPIRED = "expired", "Expired"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="privacy_jobs")
    kind = models.CharField(max_length=8, choices=Kind.choices)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    include_photos = models.BooleanField(default=False)
    result_key = models.CharField(max_length=255, blank=True)
    receipt_digest = models.CharField(max_length=64)
    receipt_expires_at = models.DateTimeField()
    expires_at = models.DateTimeField()
    pending_cleanup = models.JSONField(default=list)
    error_code = models.CharField(max_length=60, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=["status", "created_at"])]
        constraints = [
            models.CheckConstraint(condition=Q(kind__in=["export", "delete"]), name="privacy_job_kind"),
            models.CheckConstraint(condition=Q(status__in=["pending", "running", "ready", "failed", "cancelled", "expired"]), name="privacy_job_status"),
            models.CheckConstraint(condition=~Q(kind="delete", include_photos=True), name="privacy_delete_no_photo_export"),
        ]
