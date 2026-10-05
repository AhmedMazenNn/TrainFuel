from io import BytesIO
from uuid import uuid4
import warnings
from django.core.files.base import ContentFile
from django.core.files.storage import storages
from django.db import connection, transaction
from django.utils import timezone
from PIL import Image, ImageOps, UnidentifiedImageError
from rest_framework.exceptions import ValidationError
from sync.services import record_change
from .models import Asset, AttachmentClaim, CleanupTask

MAX_BYTES = 10 * 1024 * 1024
MAX_PIXELS = 20_000_000


def storage(visibility):
    return storages["catalog_media" if visibility == "public" else "private_media"]


def metadata(asset):
    return {"id": str(asset.pk), "visibility": asset.visibility, "status": asset.status, "mime_type": asset.mime_type, "byte_size": asset.byte_size, "revision": asset.revision, "source_url": asset.source_url, "license": asset.license}


def changed(asset):
    record_change("media_asset", asset.pk, asset.revision, owner=asset.owner, deleted=asset.status == "deleted", scope="catalog" if asset.visibility == "public" else "owner")


class MediaAdapter:
    @staticmethod
    def read(user, entity_id):
        from django.db.models import Q
        row = Asset.objects.filter(Q(owner=user, visibility="private") | Q(visibility="public"), pk=entity_id, deleted_at__isnull=True).first()
        return metadata(row) if row else None

    @staticmethod
    def snapshot(user):
        from django.db.models import Q
        return [{"entity_id": str(row.pk), "revision": row.revision, "data": metadata(row)} for row in Asset.objects.filter(Q(owner=user, visibility="private") | Q(visibility="public"), deleted_at__isnull=True)]

    @staticmethod
    def apply(user, operation):
        return "rejected", {"code": "use_media_lifecycle_api"}


def process_image(raw, purpose):
    """Decode, orient, then copy pixels into fresh images so embedded metadata is discarded."""
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            image = Image.open(BytesIO(raw))
            if image.format not in {"JPEG", "PNG", "WEBP", "GIF"}:
                raise ValueError()
            if image.width * image.height > MAX_PIXELS or max(image.size) > 10000:
                raise ValueError()
            frames = getattr(image, "n_frames", 1)
            if frames > 120 or frames * image.width * image.height > 80_000_000 or (frames > 1 and purpose != "exercise"):
                raise ValueError()
            output_frames, durations = [], []
            for index in range(frames):
                image.seek(index)
                source = ImageOps.exif_transpose(image).convert("RGB")
                clean = Image.new("RGB", source.size)
                clean.paste(source)
                output_frames.append(clean)
                durations.append(max(20, min(int(image.info.get("duration", 100)), 1000)))
            original, thumbnail = BytesIO(), BytesIO()
            if frames > 1:
                output_frames[0].save(original, format="GIF", save_all=True, append_images=output_frames[1:], duration=durations, loop=0)
                mime = "image/gif"
            else:
                output_frames[0].save(original, format="JPEG", quality=90)
                mime = "image/jpeg"
            output_frames[0].thumbnail((480, 480))
            output_frames[0].save(thumbnail, format="JPEG", quality=80)
            return original.getvalue(), thumbnail.getvalue(), mime
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
        raise ValidationError({"code": "invalid_image", "detail": "Use a valid JPEG, PNG, WebP, or exercise GIF within the documented limits."}) from exc


def claim_asset(user, asset_id, entity_type, entity_id, purpose):
    if not connection.in_atomic_block:
        raise RuntimeError("Attachment claims must share the domain write transaction.")
    asset = Asset.objects.select_for_update().filter(pk=asset_id, status="ready", deleted_at__isnull=True).first()
    if not asset:
        raise ValidationError({"code": "asset_unavailable"})
    if asset.visibility == "private" and asset.owner_id != user.pk:
        raise ValidationError({"code": "asset_unavailable"})
    if asset.visibility == "public" and not user.is_catalog_admin:
        raise ValidationError({"code": "asset_unavailable"})
    if asset.upload.purpose != purpose or entity_type not in {"exercise_media", "progress_photo"} or (entity_type == "progress_photo") != (purpose == "progress"):
        raise ValidationError({"code": "wrong_media_purpose"})
    existing = AttachmentClaim.objects.filter(asset=asset, deleted_at__isnull=True).first()
    if existing:
        if existing.entity_type == entity_type and str(existing.entity_id) == str(entity_id):
            return existing
        raise ValidationError({"code": "asset_already_attached"})
    return AttachmentClaim.objects.create(asset=asset, entity_type=entity_type, entity_id=entity_id)


def cleanup_key(key, visibility):
    if key:
        CleanupTask.objects.create(key=key, visibility=visibility)


def finalize(upload):
    # Caller locks upload in an atomic transaction. Storage writes are compensated on error.
    asset = Asset.objects.select_for_update().get(pk=upload.asset_id)
    if asset.deleted_at or asset.status == "deleted":
        raise ValidationError({"code": "entity_deleted"})
    if upload.status == "finalized":
        return asset
    if upload.status != "pending" or upload.expires_at <= timezone.now() or not upload.staging_key:
        raise ValidationError({"code": "upload_unavailable"})
    store = storage(asset.visibility)
    with store.open(upload.staging_key, "rb") as handle:
        raw = handle.read(MAX_BYTES + 1)
    if len(raw) > MAX_BYTES:
        raise ValidationError({"code": "file_too_large"})
    original, thumbnail, mime = process_image(raw, upload.purpose)
    written = []
    try:
        key = store.save(f"processed/{uuid4()}", ContentFile(original))
        written.append(key)
        thumb = store.save(f"processed/{uuid4()}", ContentFile(thumbnail))
        written.append(thumb)
        asset.object_key, asset.thumbnail_key = key, thumb
        asset.mime_type, asset.byte_size, asset.status = mime, len(original), "ready"
        asset.revision += 1
        asset.save()
        upload.status = "finalized"
        cleanup_key(upload.staging_key, asset.visibility)
        upload.staging_key = ""
        upload.save()
        changed(asset)
        return asset
    except Exception:
        # A crash between storage and DB commit is handled by orphan cleanup.
        for key in written:
            try:
                store.delete(key)
            except OSError:
                pass
        raise
