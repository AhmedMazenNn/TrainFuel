from uuid import uuid4
from django.test import TestCase
from django.db import transaction
from rest_framework.test import APIClient
from accounts.models import User
from .models import ChangeRecord, FeedState, Operation
from .services import record_change


class SyncTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="sync@example.com", password="Correct!Password19")
        self.other = User.objects.create_user(email="other@example.com", password="Correct!Password19")
        self.client = APIClient()
        self.client.force_login(self.user)
        self.device = str(uuid4())
        self.assertEqual(self.client.post("/api/sync/devices/", {"device_id": self.device}, format="json").status_code, 201)

    def operation(self, **overrides):
        return {"idempotency_key": str(uuid4()), "entity_type": "profile", "entity_id": str(self.user.pk), "action": "update", "base_revision": 1, "payload": {"display_name": "Local name"}, **overrides}

    def push(self, operation):
        response = self.client.post("/api/sync/push/", {"device_id": self.device, "operations": [operation]}, format="json")
        self.assertEqual(response.status_code, 200)
        return response.json()["results"][0]

    def test_retry_is_idempotent_and_payload_is_not_in_receipt(self):
        operation = self.operation()
        self.assertEqual(self.push(operation)["status"], "accepted")
        self.assertEqual(self.push(operation)["status"], "accepted")
        self.user.profile.refresh_from_db()
        self.assertEqual(self.user.profile.revision, 2)
        self.assertEqual(ChangeRecord.objects.count(), 1)
        self.assertNotIn("Local name", str(Operation.objects.get().result))
        self.assertEqual(self.push({**operation, "payload": {"display_name": "Tampered"}})["code"], "idempotency_key_reused")

    def test_concurrent_device_conflict_keeps_authoritative_and_local_versions(self):
        first = self.operation()
        self.push(first)
        conflict = self.push(self.operation(payload={"display_name": "Second device"}))
        self.assertEqual(conflict["status"], "conflict")
        self.assertEqual(conflict["current"]["display_name"], "Local name")
        self.assertEqual(self.push(self.operation(base_revision=2, payload={"display_name": "Second device"}))["status"], "accepted")

    def test_owner_boundaries_feed_and_device(self):
        self.assertEqual(self.push(self.operation(entity_id=str(self.other.pk)))["code"], "not_found")
        with transaction.atomic():
            record_change("profile", self.other.pk, 2, owner=self.other)
        self.push(self.operation())
        response = self.client.get("/api/sync/changes/", {"device_id": self.device, "after": 0}).json()
        self.assertEqual(len(response["changes"]), 1)
        self.assertEqual(response["changes"][0]["entity_id"], str(self.user.pk))
        self.client.force_login(self.other)
        self.assertEqual(self.client.get("/api/sync/snapshot/", {"device_id": self.device}).status_code, 404)

    def test_deleted_entity_cannot_be_resurrected(self):
        from django.utils import timezone
        self.user.profile.deleted_at = timezone.now()
        self.user.profile.save()
        self.assertEqual(self.push(self.operation())["code"], "entity_deleted")

    def test_cursor_expiry_and_monotonic_ack(self):
        self.push(self.operation())
        FeedState.objects.create(retention_floor=1)
        self.assertEqual(self.client.get("/api/sync/changes/", {"device_id": self.device, "after": 0}).status_code, 410)
        snapshot = self.client.get("/api/sync/snapshot/", {"device_id": self.device}).json()
        self.assertEqual(snapshot["entities"]["profile"][0]["revision"], 2)
        self.assertEqual(self.client.post("/api/sync/ack/", {"device_id": self.device, "cursor": 1}, format="json").status_code, 200)
        self.assertEqual(self.client.post("/api/sync/ack/", {"device_id": self.device, "cursor": 0}, format="json").status_code, 409)

    def test_direct_patch_emits_change_and_rejects_invalid_replay(self):
        self.client.patch("/api/profile/", {"revision": 1, "display_name": "Online"}, format="json")
        self.assertEqual(ChangeRecord.objects.count(), 1)
        result = self.push(self.operation(base_revision=2, payload={"timezone": "invalid"}))
        self.assertEqual(result["status"], "rejected")

    def test_database_rejects_invalid_scope_and_revision(self):
        from django.db import IntegrityError
        with self.assertRaises(IntegrityError), transaction.atomic():
            ChangeRecord.objects.create(owner=None, scope="owner", entity_type="profile", entity_id=self.user.pk, entity_revision=1, action="upsert")
        with self.assertRaises(IntegrityError), transaction.atomic():
            ChangeRecord.objects.create(owner=self.user, scope="owner", entity_type="profile", entity_id=self.user.pk, entity_revision=0, action="upsert")


from django.test import TransactionTestCase
from django.db import close_old_connections
from concurrent.futures import ThreadPoolExecutor
from .models import Device
from .services import replay


class SyncConcurrencyTests(TransactionTestCase):
    def test_two_devices_cannot_both_accept_the_same_base_revision(self):
        user = User.objects.create_user(email="concurrent@example.com")
        devices = [Device.objects.create(user=user) for _ in range(2)]
        def edit(index):
            close_old_connections()
            try:
                owner = User.objects.get(pk=user.pk)
                op = {"idempotency_key": uuid4(), "entity_type": "profile", "entity_id": owner.pk, "action": "update", "base_revision": 1, "payload": {"display_name": f"Device {index}"}}
                return replay(owner, devices[index].pk, [op])[0]["status"]
            finally:
                close_old_connections()
        with ThreadPoolExecutor(max_workers=2) as executor:
            outcomes = list(executor.map(edit, [0, 1]))
        self.assertCountEqual(outcomes, ["accepted", "conflict"])
        user.profile.refresh_from_db()
        self.assertEqual(user.profile.revision, 2)
        self.assertEqual(ChangeRecord.objects.count(), 1)
