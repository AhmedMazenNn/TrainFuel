from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from uuid import uuid4
from django.db import close_old_connections, transaction, IntegrityError
from django.test import TransactionTestCase
from django.utils import timezone
from rest_framework.test import APIClient
from accounts.models import User
from media_assets.models import Asset, Upload, AttachmentClaim, CleanupTask
from sync.models import Device, ChangeRecord
from sync.services import replay
from .models import WeightEntry, ProgressPhoto, Reminder
from .services import WeightAdapter, PhotoAdapter, ReminderAdapter


class ProgressTests(TransactionTestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="progress@example.com", password="Long-Progress-Secret!"
        )
        self.other = User.objects.create_user(
            email="other@example.com", password="Long-Progress-Secret!"
        )
        self.device = Device.objects.create(id=uuid4(), user=self.user, platform="web")

    def op(self, kind, payload, action="create", base=0, entity=None):
        return dict(
            idempotency_key=uuid4(),
            entity_type=kind,
            entity_id=entity or uuid4(),
            action=action,
            base_revision=base,
            payload=payload,
        )

    def apply(self, adapter, op, user=None):
        with transaction.atomic():
            return adapter.apply(user or self.user, op)

    def asset(self, user=None):
        a = Asset.objects.create(
            owner=user or self.user,
            object_key=str(uuid4()),
            thumbnail_key=str(uuid4()),
            status="ready",
            mime_type="image/jpeg",
            byte_size=40,
        )
        Upload.objects.create(
            user=user or self.user,
            asset=a,
            purpose="progress",
            status="finalized",
            expires_at=timezone.now() + timedelta(hours=1),
        )
        return a

    def photo(self, week="2026-10-05", asset=None):
        return self.op(
            "progress_photo",
            {
                "week_start": week,
                "capture_date": "2026-10-06",
                "asset_id": str((asset or self.asset()).pk),
                "label": "Front",
                "notes": "Private",
            },
        )

    def test_weight_replay_idempotency_and_tombstone(self):
        op = self.op(
            "weight_entry",
            {"local_date": "2026-10-05", "weight_kg": "80.125", "notes": "test"},
        )
        first = replay(self.user, self.device.pk, [op])[0]
        second = replay(self.user, self.device.pk, [op])[0]
        self.assertEqual(first["status"], "accepted")
        self.assertEqual(second["status"], "accepted")
        self.assertEqual(WeightEntry.objects.count(), 1)
        stale = self.op("weight_entry", op["payload"], "update", 0, op["entity_id"])
        self.assertEqual(
            self.apply(WeightAdapter, stale)[1]["code"], "revision_conflict"
        )
        delete = self.op("weight_entry", {}, "delete", 1, op["entity_id"])
        self.assertEqual(self.apply(WeightAdapter, delete)[0], "accepted")
        self.assertEqual(self.apply(WeightAdapter, stale)[1]["code"], "entity_deleted")

    def test_date_uniqueness_requires_explicit_correction(self):
        payload = {"local_date": "2026-10-05", "weight_kg": "80", "notes": ""}
        self.assertEqual(
            self.apply(WeightAdapter, self.op("weight_entry", payload))[0], "accepted"
        )
        self.assertEqual(
            self.apply(WeightAdapter, self.op("weight_entry", payload))[1]["code"],
            "date_already_recorded",
        )
        self.assertEqual(
            self.apply(
                WeightAdapter, self.op("weight_entry", {**payload, "weight_kg": "0"})
            )[0],
            "rejected",
        )

    def test_indirect_owner_and_catalog_admin(self):
        op = self.photo()
        self.assertEqual(self.apply(PhotoAdapter, op)[0], "accepted")
        self.other.is_catalog_admin = True
        self.other.save()
        self.assertIsNone(PhotoAdapter.read(self.other, op["entity_id"]))
        self.assertEqual(PhotoAdapter.snapshot(self.other), [])
        other = self.photo(asset=self.asset(self.other))
        self.assertEqual(self.apply(PhotoAdapter, other)[0], "rejected")
        client = APIClient()
        client.force_authenticate(self.other)
        self.assertEqual(client.get("/api/progress/photos/").data["count"], 0)

    def test_concurrent_fifth_never_accepted(self):
        operations = [self.photo() for _ in range(5)]

        def worker(op):
            close_old_connections()
            try:
                user = User.objects.get(pk=self.user.pk)
                with transaction.atomic():
                    return PhotoAdapter.apply(user, op)
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=5) as pool:
            results = list(pool.map(worker, operations))
        self.assertEqual(sum(status == "accepted" for status, _ in results), 4)
        self.assertEqual(
            sum(result.get("code") == "week_full" for _, result in results), 1
        )
        self.assertEqual(
            ProgressPhoto.objects.filter(deleted_at__isnull=True).count(), 4
        )
        self.assertEqual(
            AttachmentClaim.objects.filter(deleted_at__isnull=True).count(), 4
        )

    def test_full_week_move_preserves_original_and_replacement_slot(self):
        for _ in range(4):
            self.apply(PhotoAdapter, self.photo())
        original = self.photo("2026-09-28")
        self.apply(PhotoAdapter, original)
        row = ProgressPhoto.objects.get(pk=original["entity_id"])
        old_asset = row.asset_id
        move = self.op(
            "progress_photo",
            {**original["payload"], "week_start": "2026-10-05"},
            "update",
            1,
            row.pk,
        )
        self.assertEqual(self.apply(PhotoAdapter, move)[1]["code"], "week_full")
        row.refresh_from_db()
        self.assertEqual(row.week.week_start.isoformat(), "2026-09-28")
        self.assertEqual(row.asset_id, old_asset)
        replacement = self.op(
            "progress_photo",
            {**original["payload"], "asset_id": str(self.asset().pk)},
            "update",
            1,
            row.pk,
        )
        self.assertEqual(self.apply(PhotoAdapter, replacement)[0], "accepted")
        row.refresh_from_db()
        self.assertEqual(row.slot, 1)
        self.assertEqual(Asset.objects.get(pk=old_asset).status, "deleted")
        self.assertEqual(CleanupTask.objects.count(), 2)

    def test_delete_releases_slot_and_asset(self):
        first = self.photo()
        self.apply(PhotoAdapter, first)
        self.apply(
            PhotoAdapter, self.op("progress_photo", {}, "delete", 1, first["entity_id"])
        )
        new = self.photo()
        self.assertEqual(self.apply(PhotoAdapter, new)[0], "accepted")
        self.assertEqual(ProgressPhoto.objects.get(pk=new["entity_id"]).slot, 1)
        self.assertEqual(
            ChangeRecord.objects.filter(
                entity_type="progress_photo", action="delete"
            ).count(),
            1,
        )

    def test_photo_week_and_purpose_validation(self):
        op = self.photo()
        op["payload"]["week_start"] = "2026-10-06"
        self.assertEqual(self.apply(PhotoAdapter, op)[0], "rejected")
        asset = self.asset()
        asset.upload.purpose = "exercise"
        asset.upload.save()
        self.assertEqual(
            self.apply(PhotoAdapter, self.photo(asset=asset))[1]["code"],
            "wrong_media_purpose",
        )

    def test_reminder_validation_disable_and_export_erasure(self):
        payload = {
            "category": "weight",
            "local_time": "09:00",
            "weekdays": [1, 3, 5],
            "enabled": True,
        }
        op = self.op("reminder", payload)
        self.assertEqual(self.apply(ReminderAdapter, op)[0], "accepted")
        self.assertEqual(
            self.apply(
                ReminderAdapter, self.op("reminder", {**payload, "weekdays": [1, 1]})
            )[0],
            "rejected",
        )
        self.apply(
            WeightAdapter,
            self.op(
                "weight_entry",
                {"local_date": "2026-10-05", "weight_kg": "80", "notes": "Private"},
            ),
        )
        self.apply(PhotoAdapter, self.photo())
        from .lifecycle import export_data, erase_data

        exported = export_data(self.user)
        self.assertEqual(len(exported["weights"]), 1)
        self.assertNotIn("object_key", str(exported))
        with transaction.atomic():
            erase_data(self.user)
        self.assertEqual(
            export_data(self.user), {"weights": [], "photos": [], "reminders": []}
        )
        self.assertFalse(Reminder.objects.get(pk=op["entity_id"]).enabled)
        self.assertFalse(
            AttachmentClaim.objects.filter(deleted_at__isnull=True).exists()
        )

    def test_database_checks_reject_invalid_week_days_and_revision(self):
        from .models import ProgressWeek

        with self.assertRaises(IntegrityError), transaction.atomic():
            ProgressWeek.objects.create(user=self.user, week_start="2026-10-06")
        with self.assertRaises(IntegrityError), transaction.atomic():
            Reminder.objects.create(
                user=self.user, category="weight", local_time="09:00", weekdays=[1, 1]
            )
        with self.assertRaises(IntegrityError), transaction.atomic():
            WeightEntry.objects.create(
                user=self.user, local_date="2026-10-05", weight_kg="80", revision=0
            )
