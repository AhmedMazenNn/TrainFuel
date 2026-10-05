from io import BytesIO
from tempfile import TemporaryDirectory
from uuid import uuid4
from PIL import Image
from django.core import signing
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TransactionTestCase, override_settings
from django.db import transaction
from django.core.management import call_command
from rest_framework.test import APIClient
from accounts.models import User
from .models import Asset, CleanupTask
from .services import claim_asset, storage


class MediaTests(TransactionTestCase):
    def setUp(self):
        self.directory = TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.settings_override = override_settings(STORAGES={"private_media": {"BACKEND": "django.core.files.storage.FileSystemStorage", "OPTIONS": {"location": self.directory.name + "/private"}}, "catalog_media": {"BACKEND": "django.core.files.storage.FileSystemStorage", "OPTIONS": {"location": self.directory.name + "/catalog"}}})
        self.settings_override.enable()
        self.addCleanup(self.settings_override.disable)
        self.user = User.objects.create_user(email="media@example.com")
        self.other = User.objects.create_user(email="admin@example.com", is_catalog_admin=True)
        self.client = APIClient()
        self.client.force_login(self.user)

    def initiate(self, **data):
        response = self.client.post("/api/media/uploads/", {"purpose": "progress", **data}, format="json")
        self.assertEqual(response.status_code, 201)
        return response.json()

    def upload(self, info, raw=None):
        if raw is None:
            image = Image.new("RGB", (40, 60), "red")
            exif = Image.Exif()
            exif[271] = "Private camera model"
            out = BytesIO()
            image.save(out, format="JPEG", exif=exif)
            raw = out.getvalue()
        return self.client.post(f'/api/media/uploads/{info["upload_id"]}/content/', {"file": SimpleUploadedFile("wrong.png", raw, content_type="image/png")}, format="multipart")

    def finalize(self, info):
        return self.client.post(f'/api/media/uploads/{info["upload_id"]}/finalize/', {}, format="json")

    def test_staged_bytes_not_ready_processed_metadata_stripped_and_retry_safe(self):
        info = self.initiate()
        self.assertEqual(self.upload(info).status_code, 200)
        self.assertEqual(Asset.objects.get().status, "processing")
        self.assertEqual(self.finalize(info).status_code, 200)
        self.assertEqual(self.finalize(info).status_code, 200)
        asset = Asset.objects.get()
        with storage("private").open(asset.object_key) as file:
            image = Image.open(file)
            self.assertEqual(dict(image.getexif()), {})
        self.assertEqual(asset.revision, 2)
        self.assertNotIn("object_key", self.finalize(info).json())

    def test_private_access_requires_owner_session_and_expiring_header_grant(self):
        info = self.initiate()
        self.upload(info)
        self.finalize(info)
        path = f'/api/media/assets/{info["asset_id"]}'
        grant = self.client.post(path + "/access/", {}, format="json").json()
        response = self.client.get(grant["content_path"], HTTP_X_MEDIA_ACCESS=grant["token"])
        self.assertEqual(response.status_code, 200)
        self.assertIn("no-store", response["Cache-Control"])
        response.close()
        self.assertEqual(self.client.get(grant["content_path"]).status_code, 403)
        from unittest.mock import patch
        import time
        with patch("django.core.signing.time.time", return_value=time.time() + 130):
            self.assertEqual(self.client.get(grant["content_path"], HTTP_X_MEDIA_ACCESS=grant["token"]).status_code, 403)
        self.client.force_login(self.other)
        self.assertEqual(self.client.get(path + "/").status_code, 404)
        self.assertEqual(self.client.get(grant["content_path"], HTTP_X_MEDIA_ACCESS=grant["token"]).status_code, 404)
        self.assertEqual(self.client.get(f'/api/media/catalog/{info["asset_id"]}/content/').status_code, 404)

    def test_invalid_bytes_fail_and_cleanup_is_retryable(self):
        info = self.initiate()
        self.upload(info, b"not an image")
        self.assertEqual(self.finalize(info).status_code, 400)
        self.assertEqual(Asset.objects.get().upload.status, "failed")
        self.assertTrue(CleanupTask.objects.exists())
        call_command("cleanup_media", stdout=__import__('io').StringIO())
        self.assertFalse(CleanupTask.objects.exists())

    def test_deleted_pending_asset_cannot_be_finalized_or_reuploaded(self):
        info = self.initiate()
        self.upload(info)
        self.assertEqual(self.client.delete(f'/api/media/assets/{info["asset_id"]}/').status_code, 204)
        self.assertEqual(self.upload(info).status_code, 409)
        self.assertEqual(self.finalize(info).status_code, 400)
        self.assertEqual(Asset.objects.get().status, "deleted")

    def test_claim_exclusivity_purpose_and_deleted_asset(self):
        info = self.initiate()
        self.upload(info)
        self.finalize(info)
        with transaction.atomic():
            claim_asset(self.user, info["asset_id"], "progress_photo", uuid4(), "progress")
        self.assertEqual(self.client.delete(f'/api/media/assets/{info["asset_id"]}/').status_code, 409)
        from rest_framework.exceptions import ValidationError
        with self.assertRaises(ValidationError), transaction.atomic():
            claim_asset(self.user, info["asset_id"], "exercise_media", uuid4(), "exercise")
        with self.assertRaises(ValidationError), transaction.atomic():
            claim_asset(self.user, info["asset_id"], "progress_photo", uuid4(), "progress")

    def test_public_assets_require_catalog_permissions_and_rights(self):
        self.assertEqual(self.client.post("/api/media/uploads/", {"purpose": "exercise", "visibility": "public"}, format="json").status_code, 403)
        self.client.force_login(self.other)
        self.assertEqual(self.client.post("/api/media/uploads/", {"purpose": "exercise", "visibility": "public", "source_url": "https://example.com/source", "license": "CC0", "rights_confirmed": True}, format="json").status_code, 201)

    def test_database_rejects_invalid_visibility_and_zero_revision(self):
        from django.db import IntegrityError
        with self.assertRaises(IntegrityError), transaction.atomic():
            Asset.objects.create(visibility="private", owner=None, object_key="invalid/private")
        with self.assertRaises(IntegrityError), transaction.atomic():
            Asset.objects.create(visibility="public", owner=None, revision=0, object_key="invalid/revision")

    def test_orphan_scan_preserves_references_and_fresh_files(self):
        import os
        from pathlib import Path
        from django.core.files.base import ContentFile
        from io import StringIO
        import time
        info = self.initiate()
        self.upload(info)
        self.finalize(info)
        store = storage("private")
        aged = store.save("processed/orphan", ContentFile(b"orphan"))
        fresh = store.save("processed/fresh", ContentFile(b"fresh"))
        old = time.time() - 26 * 3600
        os.utime(store.path(aged), (old, old))
        asset = Asset.objects.get()
        os.utime(store.path(asset.object_key), (old, old))
        call_command("scan_media_orphans", stdout=StringIO())
        self.assertTrue(store.exists(aged))
        call_command("scan_media_orphans", delete=True, stdout=StringIO())
        self.assertFalse(store.exists(aged))
        self.assertTrue(store.exists(fresh))
        self.assertTrue(store.exists(asset.object_key))
