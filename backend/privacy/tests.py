import io
import json
import zipfile
from django.contrib.auth import get_user_model
from django.core.files.storage import storages
from django.test import TestCase, override_settings
from django.utils import timezone
from accounts.models import AuthIdentity, Profile
from media_assets.models import Asset, CleanupTask, Upload
from .models import PrivacyJob
from .services import erase_account, process_privacy_jobs, refresh_deletion_receipts


class PrivacyLifecycleTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user("owner@example.test", "good-password-123")
        self.client.force_login(self.user)
        session = self.client.session
        session["authenticated_at"] = timezone.now().timestamp()
        session.save()

    def test_export_requires_fresh_session_and_returns_private_receipt(self):
        session = self.client.session
        session["authenticated_at"] = 0
        session.save()
        denied = self.client.post("/api/privacy/exports/", data={"include_photos": False}, content_type="application/json")
        self.assertEqual(denied.status_code, 401)
        session = self.client.session
        session["authenticated_at"] = timezone.now().timestamp()
        session.save()
        response = self.client.post("/api/privacy/exports/", data={"include_photos": False}, content_type="application/json")
        self.assertEqual(response.status_code, 202)
        body = response.json()
        self.assertEqual(body["status"], "pending")
        receipt = self.client.get(body["status_path"], HTTP_X_PRIVACY_RECEIPT=body["receipt_token"])
        self.assertEqual(receipt.status_code, 200)
        self.assertEqual(receipt.json()["status"], "pending")
        self.assertEqual(self.client.get(body["status_path"]).status_code, 404)

    @override_settings(MEDIA_ROOT="/tmp/trainfuel-privacy-tests")
    def test_export_worker_creates_profile_archive_without_photo_opt_in(self):
        response = self.client.post("/api/privacy/exports/", data={"include_photos": False}, content_type="application/json")
        job_id = response.json()["job_id"]
        process_privacy_jobs()
        job = PrivacyJob.objects.get(pk=job_id)
        self.assertEqual(job.status, PrivacyJob.Status.READY)
        with storages["private_media"].open(job.result_key, "rb") as stream:
            with zipfile.ZipFile(io.BytesIO(stream.read())) as archive:
                self.assertEqual(archive.namelist(), ["trainfuel-data.json"])
                payload = json.loads(archive.read("trainfuel-data.json"))
                self.assertEqual(payload["account"]["email"], "owner@example.test")
                self.assertEqual(payload["account"]["profile"]["language"], "en")
        receipt = self.client.get(f"/api/privacy/jobs/{job_id}/download/", HTTP_X_PRIVACY_RECEIPT=response.json()["receipt_token"])
        self.assertEqual(receipt.status_code, 200)
        self.assertIn("private, no-store", receipt["Cache-Control"])

    def test_account_deletion_requires_email_and_password_then_scrubs_identity(self):
        other_device = self.client_class()
        other_device.force_login(self.user)
        other_session = other_device.session
        other_session["authenticated_at"] = timezone.now().timestamp()
        other_session.save()
        denied = self.client.post("/api/privacy/account-deletion/", data={"confirmation_email": "other@example.test", "password": "good-password-123"}, content_type="application/json")
        self.assertEqual(denied.status_code, 400)
        response = self.client.post("/api/privacy/account-deletion/", data={"confirmation_email": "owner@example.test", "password": "good-password-123"}, content_type="application/json")
        self.assertEqual(response.status_code, 202)
        job = PrivacyJob.objects.get(pk=response.json()["job_id"])
        erase_account(job.pk)
        user = get_user_model().objects.get(pk=self.user.pk)
        self.assertFalse(user.is_active)
        self.assertTrue(user.email.startswith("erased-"))
        self.assertFalse(user.has_usable_password())
        self.assertFalse(Profile.objects.filter(user=user).exists())
        refresh_deletion_receipts()
        self.assertEqual(PrivacyJob.objects.get(pk=job.pk).status, PrivacyJob.Status.READY)
        self.assertEqual(other_device.get("/api/auth/me/").json()["code"], "account_erased")

    def test_deletion_removes_provider_identity_and_queues_private_media(self):
        AuthIdentity.objects.create(user=self.user, provider="google", provider_subject="provider-subject")
        asset = Asset.objects.create(owner=self.user, visibility="private", object_key="private/original.jpg", thumbnail_key="private/thumb.jpg", status="processing")
        Upload.objects.create(user=self.user, asset=asset, purpose="progress", status="pending", staging_key="private/staged.jpg", expires_at=timezone.now())
        job = PrivacyJob.objects.create(user=self.user, kind=PrivacyJob.Kind.DELETE, receipt_digest="x" * 64, receipt_expires_at=timezone.now(), expires_at=timezone.now())
        erase_account(job.pk)
        self.assertFalse(AuthIdentity.objects.filter(user=self.user).exists())
        self.assertFalse(Asset.objects.filter(pk=asset.pk).exists())
        keys = set(CleanupTask.objects.values_list("key", flat=True))
        self.assertTrue({"private/original.jpg", "private/thumb.jpg", "private/staged.jpg"}.issubset(keys))
