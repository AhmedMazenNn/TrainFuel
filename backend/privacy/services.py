import hashlib
import importlib
import io
import json
import secrets
import tempfile
import zipfile
from datetime import timedelta
from django.apps import apps
from django.contrib.auth import get_user_model, logout
from django.contrib.sessions.models import Session
from django.contrib.sessions.backends.db import SessionStore
from django.core.files.base import File
from django.core.files.storage import storages
from django.db import connection, transaction
from django.utils import timezone
from media_assets.models import Asset, AttachmentClaim, CleanupTask, Upload
from media_assets.services import storage as media_storage
from sync.models import ChangeRecord, Device, Operation
from accounts.models import AuthIdentity, Profile
from .models import PrivacyJob

PHOTO_RETENTION_DAYS = 30
EXPORT_HOURS = 24
RECEIPT_DAYS = 30


def fresh_session(request):
    stamp = request.session.get("authenticated_at", 0)
    return isinstance(stamp, (int, float)) and 0 <= timezone.now().timestamp() - stamp <= 600


def hooks():
    # Domain apps join the boundary by shipping an app.lifecycle module.
    result = []
    for config in apps.get_app_configs():
        if config.name in {"accounts", "admin", "auth", "contenttypes", "sessions", "sync", "media_assets", "privacy"}:
            continue
        module_name = f"{config.name}.lifecycle"
        try:
            module = importlib.import_module(module_name)
        except ModuleNotFoundError as exc:
            if exc.name == module_name:
                continue
            raise
        if not callable(getattr(module, "export_data", None)) or not callable(getattr(module, "erase_data", None)):
            raise RuntimeError(f"{module_name} must implement export_data(user) and erase_data(user).")
        result.append((config.name, module))
    return result


def receipt_token():
    value = secrets.token_urlsafe(48)
    return value, hashlib.sha256(value.encode()).hexdigest()


def valid_receipt(job, token):
    return bool(token) and secrets.compare_digest(job.receipt_digest, hashlib.sha256(token.encode()).hexdigest())


def export_payload(user):
    profile = Profile.objects.filter(user=user, deleted_at__isnull=True).first()
    payload = {
        "format": "trainfuel-personal-data-v1",
        "created_at": timezone.now().isoformat(),
        "account": {"email": user.email, "profile": {
            "display_name": profile.display_name, "timezone": profile.timezone, "weight_unit": profile.weight_unit,
            "language": profile.language, "goal": profile.goal, "height_cm": str(profile.height_cm) if profile.height_cm is not None else None,
        } if profile else None, "sign_in_methods": sorted(set(user.identities.values_list("provider", flat=True)))},
        "domains": {},
    }
    for app, module in hooks():
        payload["domains"][app] = module.export_data(user)
    return payload


def export_photo_assets(user, domain_data):
    ids = set()
    def walk(value):
        if isinstance(value, dict):
            for key, item in value.items():
                if key == "asset_id" and isinstance(item, str):
                    ids.add(item)
                else:
                    walk(item)
        elif isinstance(value, list):
            for item in value:
                walk(item)
    walk(domain_data)
    media = Asset.objects.filter(pk__in=ids, owner=user, visibility="private", status="ready", deleted_at__isnull=True, upload__purpose="progress").select_related("upload")
    return list(media)


def build_export(job_id):
    # Snapshot under the same owner row lock used by all authenticated writes.
    with transaction.atomic():
        user_id = PrivacyJob.objects.values_list("user_id", flat=True).get(pk=job_id)
        user = get_user_model().objects.select_for_update().get(pk=user_id, is_active=True)
        job = PrivacyJob.objects.select_for_update().get(pk=job_id)
        if job.status != PrivacyJob.Status.PENDING:
            return
        job.status = PrivacyJob.Status.RUNNING
        job.save(update_fields=["status", "updated_at"])
        payload = export_payload(user)
        photo_assets = export_photo_assets(user, payload) if job.include_photos else []
    temp = tempfile.SpooledTemporaryFile(max_size=8 * 1024 * 1024, mode="w+b")
    key = f"exports/{job.pk}.zip"
    try:
        with zipfile.ZipFile(temp, mode="w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
            archive.writestr("trainfuel-data.json", json.dumps(payload, ensure_ascii=False, indent=2).encode())
            if photo_assets:
                archive.writestr("progress-photos/README.txt", "Private photo originals. Metadata is listed with the progress domain export.\n")
                for asset in photo_assets:
                    info = zipfile.ZipInfo(f"progress-photos/{asset.pk}.image")
                    info.compress_type = zipfile.ZIP_STORED
                    with archive.open(info, "w") as destination, media_storage("private").open(asset.object_key, "rb") as source:
                        while chunk := source.read(1024 * 1024):
                            destination.write(chunk)
        temp.seek(0)
        saved_key = storages["private_media"].save(key, File(temp, name="trainfuel-export.zip"))
        with transaction.atomic():
            job = PrivacyJob.objects.select_for_update().get(pk=job_id)
            current = get_user_model().objects.filter(pk=job.user_id, is_active=True).exists()
            if job.status != PrivacyJob.Status.RUNNING or not current:
                storages["private_media"].delete(saved_key)
                return
            job.status, job.result_key = PrivacyJob.Status.READY, saved_key
            job.expires_at = timezone.now() + timedelta(hours=EXPORT_HOURS)
            job.save(update_fields=["status", "result_key", "expires_at", "updated_at"])
    except Exception:
        storages["private_media"].delete(key)
        PrivacyJob.objects.filter(pk=job_id, status=PrivacyJob.Status.RUNNING).update(status=PrivacyJob.Status.FAILED, error_code="export_failed", updated_at=timezone.now())
        raise
    finally:
        temp.close()


def _revoke_sessions(user_id):
    for session in Session.objects.only("session_key", "session_data").iterator(chunk_size=500):
        decoded = session.get_decoded()
        if str(decoded.get("_auth_user_id", "")) == str(user_id):
            # Retain only a short-lived signal so disconnected browsers can erase
            # their local account partition when they reconnect. Authentication
            # credentials and all other session values are discarded.
            marker = SessionStore(session_key=session.session_key)
            marker.clear()
            marker["_trainfuel_account_erased"] = str(user_id)
            marker.set_expiry(timedelta(days=RECEIPT_DAYS))
            marker.save()


def erase_account(job_id):
    with transaction.atomic():
        user_id = PrivacyJob.objects.values_list("user_id", flat=True).get(pk=job_id)
        user = get_user_model().objects.select_for_update().get(pk=user_id)
        job = PrivacyJob.objects.select_for_update().get(pk=job_id)
        if job.status != PrivacyJob.Status.PENDING:
            return
        if not user.is_active:
            job.status, job.error_code = PrivacyJob.Status.FAILED, "account_unavailable"
            job.save(update_fields=["status", "error_code", "updated_at"])
            return
        job.status = PrivacyJob.Status.RUNNING
        job.save(update_fields=["status", "updated_at"])
        cleanup_ids = []
        # Cancel old exports and queue their files for deletion.
        for export in PrivacyJob.objects.select_for_update().filter(user=user, kind=PrivacyJob.Kind.EXPORT).exclude(status__in=[PrivacyJob.Status.CANCELLED, PrivacyJob.Status.EXPIRED]):
            if export.result_key:
                cleanup_ids.append(CleanupTask.objects.create(key=export.result_key, visibility="private").pk)
            export.status, export.result_key = PrivacyJob.Status.CANCELLED, ""
            export.save(update_fields=["status", "result_key", "updated_at"])
        # Each domain hook must erase private records and release cross-domain media claims.
        for _name, module in hooks():
            module.erase_data(user)
        media = list(Asset.objects.select_for_update().filter(owner=user, visibility="private"))
        for asset in media:
            upload = Upload.objects.filter(asset=asset).first()
            if asset.object_key:
                cleanup_ids.append(CleanupTask.objects.create(key=asset.object_key, visibility="private").pk)
            if asset.thumbnail_key:
                cleanup_ids.append(CleanupTask.objects.create(key=asset.thumbnail_key, visibility="private").pk)
            if upload and upload.staging_key:
                cleanup_ids.append(CleanupTask.objects.create(key=upload.staging_key, visibility="private").pk)
            AttachmentClaim.objects.filter(asset=asset).delete()
            Upload.objects.filter(asset=asset).delete()
            asset.delete()
        # Remove sync identifiers/receipts belonging only to this erased account.
        Operation.objects.filter(device__user=user).delete()
        Device.objects.filter(user=user).delete()
        ChangeRecord.objects.filter(owner=user, scope="owner").delete()
        AuthIdentity.objects.filter(user=user).delete()
        Profile.objects.filter(user=user).delete()
        _revoke_sessions(user.pk)
        # Invalidate all future password/provider authentication and replace contact/name data.
        user.email = f"erased-{user.pk}@invalid.trainfuel.local"
        user.first_name = ""
        user.last_name = ""
        user.password = "!"
        user.last_login = None
        user.email_verified_at = None
        user.is_catalog_admin = False
        user.is_active = False
        user.is_staff = False
        user.is_superuser = False
        user.date_joined = timezone.now()
        user.save(update_fields=["email", "first_name", "last_name", "password", "last_login", "email_verified_at", "is_catalog_admin", "is_active", "is_staff", "is_superuser", "date_joined"])
        job.status, job.pending_cleanup = PrivacyJob.Status.RUNNING, cleanup_ids
        job.expires_at = timezone.now() + timedelta(days=RECEIPT_DAYS)
        job.save(update_fields=["status", "pending_cleanup", "expires_at", "updated_at"])


def refresh_deletion_receipts():
    now = timezone.now()
    for job in PrivacyJob.objects.filter(kind=PrivacyJob.Kind.DELETE, status=PrivacyJob.Status.RUNNING).iterator(chunk_size=100):
        remaining = CleanupTask.objects.filter(pk__in=job.pending_cleanup).exists()
        if not remaining:
            PrivacyJob.objects.filter(pk=job.pk, status=PrivacyJob.Status.RUNNING).update(status=PrivacyJob.Status.READY, pending_cleanup=[], updated_at=now)


def queue_expired_exports():
    now = timezone.now()
    for job in PrivacyJob.objects.filter(kind=PrivacyJob.Kind.EXPORT, status=PrivacyJob.Status.READY, expires_at__lte=now).iterator(chunk_size=100):
        with transaction.atomic():
            locked = PrivacyJob.objects.select_for_update().get(pk=job.pk)
            if locked.status != PrivacyJob.Status.READY or locked.expires_at > now:
                continue
            cleanup_id = CleanupTask.objects.create(key=locked.result_key, visibility="private").pk
            locked.status, locked.result_key, locked.pending_cleanup = PrivacyJob.Status.EXPIRED, "", [cleanup_id]
            locked.save(update_fields=["status", "result_key", "pending_cleanup", "updated_at"])


def process_privacy_jobs(limit=20):
    # Delete storage objects and retry failures without logging keys, file contents, or users.
    from django.db.models import F
    for task in CleanupTask.objects.order_by("pk")[:limit]:
        try:
            media_storage(task.visibility).delete(task.key)
        except Exception:
            CleanupTask.objects.filter(pk=task.pk).update(attempts=F("attempts") + 1)
        else:
            task.delete()
    refresh_deletion_receipts()
    queue_expired_exports()
    PrivacyJob.objects.filter(
        receipt_expires_at__lte=timezone.now(),
        pending_cleanup=[],
        result_key="",
        status__in=[PrivacyJob.Status.READY, PrivacyJob.Status.FAILED, PrivacyJob.Status.CANCELLED, PrivacyJob.Status.EXPIRED],
    ).delete()
    with transaction.atomic():
        jobs = list(PrivacyJob.objects.select_for_update(skip_locked=True).filter(status=PrivacyJob.Status.PENDING).order_by("created_at")[:limit])
        jobs = [(job.pk, job.kind) for job in jobs]
    for job_id, kind in jobs:
        try:
            if kind == PrivacyJob.Kind.EXPORT:
                build_export(job_id)
            else:
                erase_account(job_id)
        except Exception:
            # Keep the long-running worker alive and expose only a stable error code.
            PrivacyJob.objects.filter(pk=job_id, status__in=[PrivacyJob.Status.PENDING, PrivacyJob.Status.RUNNING]).update(
                status=PrivacyJob.Status.FAILED,
                error_code="request_failed",
                updated_at=timezone.now(),
            )
