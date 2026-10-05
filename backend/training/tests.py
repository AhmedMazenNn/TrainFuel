from copy import deepcopy
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from uuid import uuid4
from django.db import transaction, IntegrityError, close_old_connections
from django.test import TestCase, TransactionTestCase
from django.utils import timezone
from rest_framework.test import APIClient
from accounts.models import User
from sync.models import Device, ChangeRecord
from sync.services import replay
from .models import (Exercise, ExerciseText, Annotation, WorkoutFolder, FolderExercise, PlannedSet, ExerciseRecord, RecordedSet, CatalogAudit)
from .services import ExerciseAdapter, FolderAdapter, RecordAdapter, AnnotationAdapter


def exercise_payload(visibility="private"):
    return {"visibility": visibility, "category": "strength", "equipment": "dumbbell", "translations": [{"language": "en", "name": "Row", "instructions": ["Brace", "Pull"]}], "muscles": [{"code": "back", "role": "primary"}], "media": []}


def lift_set(weight="20.000", reps=12):
    return {"id": str(uuid4()), "weight_kg": weight, "reps": reps}


def apply(adapter, user, payload, entity_id=None, action="create", revision=0):
    entity_id = entity_id or uuid4()
    with transaction.atomic():
        result = adapter.apply(user, {"entity_id": entity_id, "action": action, "base_revision": revision, "payload": payload})
    return entity_id, result


class TrainingTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("training@example.com", "Training-password!")
        self.other = User.objects.create_user("other@example.com", "Training-password!")
        self.admin = User.objects.create_user("admin@example.com", "Training-password!", is_catalog_admin=True)
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.exercise_id, result = apply(ExerciseAdapter, self.user, exercise_payload())
        self.assertEqual(result[0], "accepted")

    def folder(self, **kwargs):
        payload = {"name": "Pull", "position": 1, "entries": [{"id": str(uuid4()), "exercise_id": str(self.exercise_id), "sets": [lift_set(), lift_set("22.000", 10), lift_set("22.000", 8)]}]}
        payload.update(kwargs)
        entity_id, result = apply(FolderAdapter, self.user, payload)
        self.assertEqual(result[0], "accepted")
        return entity_id, payload

    def record(self, context=None):
        payload = {"exercise_id": str(self.exercise_id), "folder_exercise_id": context, "local_date": "2026-10-05", "recorded_at": "2026-10-05T10:00:00Z", "kind": "performed", "notes": "", "sets": [lift_set("24.000", 8)]}
        entity_id, result = apply(RecordAdapter, self.user, payload)
        self.assertEqual(result[0], "accepted")
        return entity_id, payload

    def test_owner_scope_including_catalog_administrator(self):
        folder_id, _ = self.folder()
        record_id, _ = self.record()
        for principal in [self.other, self.admin]:
            client = APIClient(); client.force_authenticate(principal)
            for resource, pk in [("exercises", self.exercise_id), ("folders", folder_id), ("records", record_id)]:
                self.assertEqual(client.get(f"/api/training/{resource}/{pk}/").status_code, 404)
                self.assertEqual(client.delete(f"/api/training/{resource}/{pk}/", {"revision": 1}, format="json").status_code, 404)
            self.assertEqual(apply(FolderAdapter, principal, {"name": "Stolen", "position": 1, "entries": [{"id": str(uuid4()), "exercise_id": str(self.exercise_id), "sets": []}]})[1][0], "rejected")
            self.assertFalse(WorkoutFolder.objects.filter(user=principal).exists())

    def test_shared_catalog_permission_translations_search_audit(self):
        self.assertEqual(apply(ExerciseAdapter, self.user, exercise_payload("shared"))[1][0], "rejected")
        eid, result = apply(ExerciseAdapter, self.admin, exercise_payload("shared"))
        self.assertEqual(result[0], "accepted")
        self.assertEqual(CatalogAudit.objects.get(exercise_id=eid).fields, ["archived", "category", "equipment", "media", "muscles", "translations", "visibility"])
        rows = self.client.get("/api/training/exercises/?q=row&muscle=back&equipment=dumbbell").json()["results"]
        self.assertEqual(len(rows), 2)
        self.assertTrue(any(row["id"] == str(eid) for row in rows))
        self.assertEqual(self.client.get("/api/training/catalog-audit/").status_code, 404)

    def test_annotations_never_leak_through_shared_catalog(self):
        eid, _ = apply(ExerciseAdapter, self.admin, exercise_payload("shared"))
        aid, result = apply(AnnotationAdapter, self.user, {"exercise_id": str(eid), "tutorial_url": "https://example.com/tutorial", "notes": "private"})
        self.assertEqual(result[0], "accepted")
        self.assertIsNone(AnnotationAdapter.read(self.other, aid))
        self.assertNotIn("tutorial_url", ExerciseAdapter.read(self.other, eid))
        self.assertEqual(apply(AnnotationAdapter, self.other, {"exercise_id": str(eid), "tutorial_url": "http://example.com"})[1][0], "rejected")
        self.assertEqual(apply(AnnotationAdapter, self.user, {"exercise_id": str(eid), "tutorial_url": "https://example.com/again"})[1][0], "conflict")

    def test_prescriptions_remain_separate_from_performed_history(self):
        folder_id, folder = self.folder()
        record_id, record = self.record(folder["entries"][0]["id"])
        before = FolderAdapter.read(self.user, folder_id)
        record["sets"][0]["weight_kg"] = "30.000"
        self.assertEqual(apply(RecordAdapter, self.user, record, record_id, "update", 1)[1][0], "accepted")
        self.assertEqual(FolderAdapter.read(self.user, folder_id), before)
        self.assertEqual(RecordAdapter.read(self.user, record_id)["revision"], 2)
        self.assertEqual([s["weight_kg"] for s in before["entries"][0]["sets"]], ["20.000", "22.000", "22.000"])

    def test_folder_deletion_preserves_history_and_clears_context(self):
        folder_id, folder = self.folder()
        rid, _ = self.record(folder["entries"][0]["id"])
        self.assertEqual(apply(FolderAdapter, self.user, {}, folder_id, "delete", 1)[1][0], "accepted")
        record = RecordAdapter.read(self.user, rid)
        self.assertEqual(record["local_date"], "2026-10-05")
        self.assertIsNone(record["folder_exercise_id"])
        self.assertEqual(record["revision"], 2)
        self.assertEqual(len(record["sets"]), 1)
        self.assertTrue(ChangeRecord.objects.filter(entity_id=folder_id, action="delete").exists())

    def test_archived_exercise_is_readable_but_cannot_be_newly_selected(self):
        fid, folder = self.folder()
        data = exercise_payload(); data["archived"] = True
        apply(ExerciseAdapter, self.user, data, self.exercise_id, "update", 1)
        self.assertTrue(ExerciseAdapter.read(self.user, self.exercise_id)["archived"])
        self.assertEqual(apply(FolderAdapter, self.user, folder, fid, "update", 1)[1][0], "accepted")
        new = deepcopy(folder); new["entries"][0]["id"] = str(uuid4())
        self.assertEqual(apply(FolderAdapter, self.user, new)[1][0], "rejected")

    def test_foreign_indirect_context_and_child_ids_rejected(self):
        fid, folder = self.folder()
        other_eid, _ = apply(ExerciseAdapter, self.other, exercise_payload())
        self.assertEqual(apply(RecordAdapter, self.other, {"exercise_id": str(other_eid), "folder_exercise_id": folder["entries"][0]["id"], "local_date": "2026-10-05", "recorded_at": "2026-10-05T10:00:00Z", "kind": "reference", "sets": [lift_set()]})[1][0], "rejected")
        stolen = deepcopy(folder); stolen["name"] = "Another"; stolen["entries"][0]["id"] = str(uuid4())
        self.assertEqual(apply(FolderAdapter, self.user, stolen)[1][0], "rejected")
        self.assertEqual(WorkoutFolder.objects.count(), 1)

    def test_aggregate_reorder_and_repeated_exercise_selection(self):
        fid, folder = self.folder()
        folder["entries"].append({"id": str(uuid4()), "exercise_id": str(self.exercise_id), "sets": [lift_set("0.000", 1)]})
        folder["entries"].reverse()
        folder["entries"][1]["sets"].reverse()
        self.assertEqual(apply(FolderAdapter, self.user, folder, fid, "update", 1)[1][0], "accepted")
        result = FolderAdapter.read(self.user, fid)
        self.assertEqual(result["entries"][0]["id"], folder["entries"][0]["id"])
        self.assertEqual([s["reps"] for s in result["entries"][1]["sets"]], [8, 10, 12])

    def test_empty_finalized_record_and_invalid_sets_rejected(self):
        rid, payload = self.record()
        for sets in [[], [lift_set("-1.000")], [lift_set(reps=0)]]:
            data = deepcopy(payload); data["sets"] = sets
            self.assertEqual(apply(RecordAdapter, self.user, data, rid, "update", 1)[1][0], "rejected")
        self.assertEqual(ExerciseRecord.objects.get(pk=rid).revision, 1)

    def test_stale_revision_delete_tombstone_and_retry_idempotency(self):
        fid, folder = self.folder()
        device = Device.objects.create(user=self.user, platform="web")
        op = {"idempotency_key": uuid4(), "entity_type": "workout_folder", "entity_id": fid, "action": "update", "base_revision": 1, "payload": {**folder, "name": "Edited"}}
        self.assertEqual(replay(self.user, device.pk, [op])[0]["status"], "accepted")
        self.assertEqual(replay(self.user, device.pk, [op])[0]["status"], "accepted")
        self.assertEqual(WorkoutFolder.objects.get(pk=fid).revision, 2)
        self.assertEqual(apply(FolderAdapter, self.user, folder, fid, "update", 1)[1][0], "conflict")
        apply(FolderAdapter, self.user, {}, fid, "delete", 2)
        self.assertEqual(apply(FolderAdapter, self.user, folder, fid)[1][1]["code"], "entity_deleted")

    def test_real_postgresql_constraints(self):
        fid, folder = self.folder()
        entry = FolderExercise.objects.get(pk=folder["entries"][0]["id"])
        with self.assertRaises(IntegrityError), transaction.atomic():
            PlannedSet.objects.create(folder_exercise=entry, position=1, weight_kg=1, reps=1)
        with self.assertRaises(IntegrityError), transaction.atomic():
            PlannedSet.objects.create(folder_exercise=entry, position=99, weight_kg=-1, reps=1)
        with self.assertRaises(IntegrityError), transaction.atomic():
            Exercise.objects.create(owner=self.user, visibility="shared", category="strength", equipment="bodyweight")

    def test_download_manifest_authorized_and_contains_annotations(self):
        fid, _ = self.folder()
        apply(AnnotationAdapter, self.user, {"exercise_id": str(self.exercise_id), "tutorial_url": "https://example.com/tutorial"})
        response = self.client.get(f"/api/training/folders/{fid}/download/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["exercises"]), 1)
        self.assertEqual(len(response.json()["annotations"]), 1)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(f"/api/training/folders/{fid}/download/").status_code, 404)

    def test_pagination_and_atomic_folder_scope_reorder(self):
        f1, _ = self.folder()
        f2, _ = self.folder(name="Two", position=2)
        self.assertEqual(self.client.get("/api/training/folders/?limit=1").json()["next_offset"], 1)
        response = self.client.post("/api/training/folders/reorder/", {"folders": [{"id": str(f2), "revision": 1}, {"id": str(f1), "revision": 1}]}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(WorkoutFolder.objects.get(pk=f2).position, 1)
        response = self.client.post("/api/training/folders/reorder/", {"folders": [{"id": str(f1), "revision": 1}, {"id": str(f2), "revision": 1}]}, format="json")
        self.assertEqual(response.status_code, 409)
        self.assertEqual(WorkoutFolder.objects.get(pk=f2).position, 1)

    def test_lifecycle_export_and_private_content_erasure(self):
        from .lifecycle import export_data, erase_data
        fid, folder = self.folder()
        rid, _ = self.record(folder["entries"][0]["id"])
        apply(AnnotationAdapter, self.user, {"exercise_id": str(self.exercise_id), "tutorial_url": "https://example.com/private", "notes": "personal"})
        self.assertEqual(len(export_data(self.user)["records"]), 1)
        with transaction.atomic(): erase_data(self.user)
        self.assertIsNone(FolderAdapter.read(self.user, fid))
        self.assertIsNone(RecordAdapter.read(self.user, rid))
        self.assertFalse(ExerciseText.objects.filter(exercise__owner=self.user).exists())
        self.assertFalse(RecordedSet.objects.filter(record__user=self.user).exists())
        self.assertFalse(Annotation.objects.filter(user=self.user).exclude(notes="", tutorial_url="").exists())

    def test_media_ownership_visibility_exclusivity_and_release(self):
        from media_assets.models import Asset, Upload, AttachmentClaim
        asset = Asset.objects.create(owner=self.user, visibility="private", object_key="training-test-ready", status="ready", byte_size=20, mime_type="image/jpeg")
        Upload.objects.create(user=self.user, asset=asset, purpose="exercise", status="finalized", expires_at=timezone.now())
        attachment_id = uuid4()
        payload = exercise_payload(); payload["media"] = [{"id": str(attachment_id), "asset_id": str(asset.pk)}]
        self.assertEqual(apply(ExerciseAdapter, self.user, payload, self.exercise_id, "update", 1)[1][0], "accepted")
        self.assertTrue(AttachmentClaim.objects.filter(entity_id=attachment_id, deleted_at__isnull=True).exists())
        self.assertEqual(apply(ExerciseAdapter, self.other, payload)[1][0], "rejected")
        payload["media"][0]["id"] = str(uuid4())
        self.assertEqual(apply(ExerciseAdapter, self.user, payload)[1][0], "rejected")
        self.assertEqual(apply(ExerciseAdapter, self.user, exercise_payload(), self.exercise_id, "update", 2)[1][0], "accepted")
        self.assertFalse(AttachmentClaim.objects.filter(entity_id=attachment_id, deleted_at__isnull=True).exists())
        self.assertEqual(apply(ExerciseAdapter, self.user, payload)[1][0], "accepted")

    def test_owner_wide_order_adapter_rejects_cross_owner_and_stale_scope(self):
        from .services import OrderAdapter
        first, _ = self.folder()
        second, _ = self.folder(name="Two", position=2)
        body = {"folders": [{"id": str(second), "revision": 1}, {"id": str(first), "revision": 1}]}
        self.assertEqual(apply(OrderAdapter, self.user, body, self.user.pk, "update", 1)[1][0], "accepted")
        self.assertEqual(WorkoutFolder.objects.get(pk=second).position, 1)
        self.assertEqual(apply(OrderAdapter, self.user, body, self.user.pk, "update", 1)[1][0], "conflict")
        self.assertEqual(apply(OrderAdapter, self.other, body, self.user.pk, "update", 1)[1][0], "rejected")


class TrainingConcurrencyTests(TransactionTestCase):
    reset_sequences = True

    def test_same_record_two_devices_accepts_one_and_preserves_other_as_conflict(self):
        user = User.objects.create_user("race-training@example.com", "Training-password!")
        # TransactionTestCase flushes data migrations between tests.
        from .models import Muscle
        Muscle.objects.get_or_create(code="back", defaults={"name_translations": {"en": "Back", "ar": "الظهر"}})
        eid, _ = apply(ExerciseAdapter, user, exercise_payload())
        fid, _ = apply(FolderAdapter, user, {"name": "Before", "position": 1, "entries": []})
        def update(name):
            close_old_connections()
            try:
                principal = User.objects.get(pk=user.pk)
                return apply(FolderAdapter, principal, {"name": name, "position": 1, "entries": []}, fid, "update", 1)[1][0]
            finally: close_old_connections()
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(update, ["Device A", "Device B"]))
        self.assertCountEqual(results, ["accepted", "conflict"])
        self.assertEqual(WorkoutFolder.objects.get(pk=fid).revision, 2)
