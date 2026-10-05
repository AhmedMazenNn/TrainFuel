from datetime import timedelta
from uuid import uuid4
from django.core import signing
from django.core.files.base import ContentFile
from django.db import transaction
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from sync.views import SyncAPIView
from .models import Asset, AttachmentClaim, Upload
from .services import MAX_BYTES, changed, cleanup_key, finalize, metadata, storage


class MediaAPIView(SyncAPIView):
    throttle_scope = "media"

    def asset(self, request, pk):
        return get_object_or_404(Asset, pk=pk, owner=request.user, visibility="private", deleted_at__isnull=True)


class InitiateView(MediaAPIView):
    def post(self, request):
        purpose = serializers.ChoiceField(choices=["exercise", "progress"]).run_validation(request.data.get("purpose"))
        visibility = serializers.ChoiceField(choices=["private", "public"]).run_validation(request.data.get("visibility", "private"))
        source, license_text = "", ""
        if visibility == "public":
            if not request.user.is_catalog_admin or purpose != "exercise":
                return Response({"code": "catalog_permission_required"}, status=403)
            source = serializers.URLField().run_validation(request.data.get("source_url"))
            license_text = serializers.CharField(max_length=255).run_validation(request.data.get("license"))
            if not source.startswith("https://") or request.data.get("rights_confirmed") is not True:
                raise serializers.ValidationError({"code": "media_rights_required"})
        with transaction.atomic():
            asset = Asset.objects.create(owner=request.user if visibility == "private" else None, visibility=visibility, object_key=f"reserved/{uuid4()}", source_url=source, license=license_text)
            upload = Upload.objects.create(user=request.user, asset=asset, purpose=purpose, expires_at=timezone.now() + timedelta(hours=2))
            changed(asset)
        return Response({"upload_id": str(upload.pk), "asset_id": str(asset.pk), "expires_at": upload.expires_at, "max_bytes": MAX_BYTES}, status=201)


class ContentUploadView(MediaAPIView):
    parser_classes = [MultiPartParser]

    def post(self, request, pk):
        file = request.FILES.get("file")
        if not file or file.size > MAX_BYTES:
            raise serializers.ValidationError({"code": "file_too_large_or_missing"})
        with transaction.atomic():
            upload = get_object_or_404(Upload.objects.select_for_update().select_related("asset"), pk=pk, user=request.user)
            if upload.status != "pending" or upload.expires_at <= timezone.now() or upload.asset.deleted_at:
                return Response({"code": "upload_unavailable"}, status=409)
            raw = file.read(MAX_BYTES + 1)
            if len(raw) > MAX_BYTES:
                raise serializers.ValidationError({"code": "file_too_large"})
            key = storage(upload.asset.visibility).save(f"staging/{uuid4()}", ContentFile(raw))
            cleanup_key(upload.staging_key, upload.asset.visibility)
            upload.staging_key = key
            upload.save(update_fields=["staging_key", "updated_at"])
        return Response({"status": "pending", "detail": "Bytes staged; finalization is required."})


class FinalizeView(MediaAPIView):
    def post(self, request, pk):
        with transaction.atomic():
            upload = get_object_or_404(Upload.objects.select_for_update(), pk=pk, user=request.user)
            try:
                with transaction.atomic():
                    asset = finalize(upload)
            except serializers.ValidationError as exc:
                upload.refresh_from_db()
                upload.status, upload.error_code = "failed", "invalid_or_expired_upload"
                cleanup_key(upload.staging_key, upload.asset.visibility)
                upload.staging_key = ""
                upload.save()
                return Response(exc.detail, status=400)
        return Response(metadata(asset))


class AssetView(MediaAPIView):
    def get(self, request, pk):
        return Response(metadata(self.asset(request, pk)))

    def delete(self, request, pk):
        with transaction.atomic():
            asset = get_object_or_404(Asset.objects.select_for_update(), pk=pk, owner=request.user, visibility="private")
            if asset.status == "deleted":
                return Response(status=204)
            if AttachmentClaim.objects.filter(asset=asset, deleted_at__isnull=True).exists():
                return Response({"code": "asset_attached"}, status=409)
            asset.status, asset.deleted_at = "deleted", timezone.now()
            asset.revision += 1
            asset.save()
            for key in [asset.object_key, asset.thumbnail_key, asset.upload.staging_key]:
                cleanup_key(key, asset.visibility)
            upload = asset.upload
            upload.status, upload.staging_key, upload.error_code = "failed", "", "entity_deleted"
            upload.save()
            changed(asset)
        return Response(status=204)


class AccessView(MediaAPIView):
    def post(self, request, pk):
        asset = self.asset(request, pk)
        if asset.status != "ready":
            return Response({"code": "media_not_ready"}, status=409)
        variant = serializers.ChoiceField(choices=["original", "thumbnail"]).run_validation(request.data.get("variant", "thumbnail"))
        token = signing.dumps({"asset": str(asset.pk), "owner": str(request.user.pk), "variant": variant}, salt="private-media")
        return Response({"token": token, "expires_in": 120, "content_path": f"/api/media/assets/{asset.pk}/content/"})


class PrivateContentView(MediaAPIView):
    def get(self, request, pk):
        asset = self.asset(request, pk)
        try:
            grant = signing.loads(request.headers.get("X-Media-Access", ""), salt="private-media", max_age=120)
            if grant["asset"] != str(asset.pk) or grant["owner"] != str(request.user.pk) or grant["variant"] not in {"original", "thumbnail"} or asset.status != "ready":
                raise signing.BadSignature()
        except (signing.BadSignature, KeyError):
            return Response({"code": "access_expired_or_invalid"}, status=403)
        key = asset.thumbnail_key if grant["variant"] == "thumbnail" else asset.object_key
        response = FileResponse(storage("private").open(key, "rb"), content_type="image/jpeg" if grant["variant"] == "thumbnail" else asset.mime_type)
        response["Cache-Control"] = "private, no-store"
        response["X-Content-Type-Options"] = "nosniff"
        return response


class CatalogContentView(MediaAPIView):
    permission_classes = [AllowAny]

    def get(self, request, pk):
        asset = get_object_or_404(Asset, pk=pk, visibility="public", status="ready", deleted_at__isnull=True)
        response = FileResponse(storage("public").open(asset.object_key, "rb"), content_type=asset.mime_type)
        response["X-Content-Type-Options"] = "nosniff"
        return response
