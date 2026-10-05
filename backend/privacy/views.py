from datetime import timedelta
from django.contrib.auth import get_user_model, logout
from django.db import transaction
from django.db.models import F
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from accounts.models import Profile
from accounts.views import AccountAPIView, MeView
from .models import PrivacyJob
from .serializers import DeleteRequestSerializer, ExportRequestSerializer, ReceiptSerializer
from .services import RECEIPT_DAYS, fresh_session, receipt_token, valid_receipt

class PrivacyAPIView(AccountAPIView):
    permission_classes = [IsAuthenticated]
    throttle_scope = "auth"

    def fresh(self, request):
        if not fresh_session(request):
            return Response({"detail": "Sign in again before changing privacy settings.", "code": "reauthentication_required"}, status=401)

    def create_job(self, user, kind, include_photos=False):
        token, digest = receipt_token()
        now = timezone.now()
        job = PrivacyJob.objects.create(user=user, kind=kind, status=PrivacyJob.Status.PENDING, include_photos=include_photos, receipt_digest=digest, receipt_expires_at=now + timedelta(days=RECEIPT_DAYS), expires_at=now + timedelta(days=RECEIPT_DAYS))
        return job, token


class ExportRequestView(PrivacyAPIView):
    def post(self, request):
        denied = self.fresh(request)
        if denied:
            return denied
        serializer = ExportRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        job, token = self.create_job(request.user, PrivacyJob.Kind.EXPORT, serializer.validated_data["include_photos"])
        return Response({"job_id": str(job.pk), "kind": job.kind, "status": job.status, "receipt_token": token, "status_path": f"/api/privacy/jobs/{job.pk}/", "detail": "Your export is being prepared."}, status=202)


class DeletionRequestView(PrivacyAPIView):
    def post(self, request):
        denied = self.fresh(request)
        if denied:
            return denied
        serializer = DeleteRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        if values["confirmation_email"].strip().casefold() != request.user.email.casefold():
            return Response({"code": "confirmation_mismatch", "detail": "Enter the email address on this account to continue."}, status=400)
        if request.user.has_usable_password():
            if not values.get("password") or not request.user.check_password(values["password"]):
                return Response({"code": "invalid_credentials", "detail": "The password is incorrect."}, status=400)
        with transaction.atomic():
            user = get_user_model().objects.select_for_update().get(pk=request.user.pk, is_active=True)
            job, token = self.create_job(user, PrivacyJob.Kind.DELETE)
            # Invalidate this browser immediately; its active IndexedDB cache is also erased client-side.
            logout(request)
        return Response({"job_id": str(job.pk), "kind": job.kind, "status": job.status, "receipt_token": token, "status_path": f"/api/privacy/jobs/{job.pk}/", "detail": "Account deletion is queued. Server records and private files are being removed."}, status=202)


@method_decorator(never_cache, name="dispatch")
class ReceiptView(PrivacyAPIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = []

    def job(self, request, pk):
        job = get_object_or_404(PrivacyJob.objects.select_related("user"), pk=pk)
        token = request.headers.get("X-Privacy-Receipt", "")
        if not token:
            return None
        serializer = ReceiptSerializer(data={"token": token})
        serializer.is_valid(raise_exception=True)
        if job.receipt_expires_at <= timezone.now() or not valid_receipt(job, serializer.validated_data["token"]):
            return None
        return job

    def get(self, request, pk):
        job = self.job(request, pk)
        if not job:
            return Response({"code": "receipt_unavailable"}, status=404)
        return Response({"job_id": str(job.pk), "kind": job.kind, "status": job.status, "error_code": job.error_code or None, "created_at": job.created_at, "expires_at": job.expires_at, "download_path": f"/api/privacy/jobs/{job.pk}/download/" if job.kind == PrivacyJob.Kind.EXPORT and job.status == PrivacyJob.Status.READY else None})

    def post(self, request, pk):
        return Response({"detail": "Use GET to check this privacy request."}, status=405)


class ExportDownloadView(ReceiptView):
    def get(self, request, pk):
        job = self.job(request, pk)
        if not job or job.kind != PrivacyJob.Kind.EXPORT:
            return Response({"code": "receipt_unavailable"}, status=404)
        if job.status != PrivacyJob.Status.READY or not job.result_key or job.expires_at <= timezone.now():
            return Response({"code": "export_not_ready", "status": job.status}, status=409)
        from django.core.files.storage import storages
        response = FileResponse(storages["private_media"].open(job.result_key, "rb"), as_attachment=True, filename="trainfuel-personal-data.zip", content_type="application/zip")
        response["Cache-Control"] = "private, no-store"
        response["X-Content-Type-Options"] = "nosniff"
        return response


class ErasedSessionView(MeView):
    """Distinguish erased accounts from temporary offline sessions on /auth/me/."""
    permission_classes = [AllowAny]
    throttle_classes = []

    def get(self, request):
        if request.user.is_authenticated:
            return super().get(request)
        erased_id = request.session.get("_trainfuel_account_erased")
        user_id = request.session.get("_auth_user_id")
        user_id = erased_id or user_id
        erased = bool(user_id and not get_user_model().objects.filter(pk=user_id, is_active=True).exists() and not Profile.objects.filter(user_id=user_id).exists())
        return Response({"code": "account_erased" if erased else "session_required", "detail": "This account was erased." if erased else "Authentication credentials were not provided."}, status=403)
