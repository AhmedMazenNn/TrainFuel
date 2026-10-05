import uuid
import json
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from django.db import transaction, IntegrityError, close_old_connections
from django.test import TestCase, TransactionTestCase
from rest_framework.test import APIClient
from accounts.models import User
from sync.models import Device, ChangeRecord
from sync.services import replay
from .models import NutritionTarget, NutritionDay, FoodEntry
from .services import TargetAdapter, DayAdapter, FoodAdapter, counters
from .lifecycle import export_data, erase_data


class NutritionTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="nutrition@example.com", password="nutrition-test-pass!"
        )
        self.other = User.objects.create_user(
            email="other@example.com", password="nutrition-test-pass!"
        )
        self.client = APIClient()
        self.client.force_login(self.user)

    def mutate(
        self, adapter, payload, entity_id=None, revision=0, action="create", user=None
    ):
        entity_id = entity_id or uuid.uuid4()
        with transaction.atomic():
            result = adapter.apply(
                user or self.user,
                {
                    "entity_id": entity_id,
                    "base_revision": revision,
                    "action": action,
                    "payload": payload,
                },
            )
        return entity_id, result

    def day(self, date="2026-01-01"):
        identifier, result = self.mutate(DayAdapter, {"local_date": date})
        self.assertEqual(result[0], "accepted")
        return identifier

    def food(self, day, **kwargs):
        return {
            "day": str(day),
            "name": "Rice",
            "portion_g": "150",
            "calories_kcal": "200",
            "protein_g": "30",
            "carbs_g": "0",
            "fat_g": "0",
            "status": "complete",
            **kwargs,
        }

    def test_portion_totals_and_zero_unknown(self):
        day = self.day()
        _, result = self.mutate(FoodAdapter, self.food(day))
        self.assertEqual(result[0], "accepted")
        self.mutate(
            FoodAdapter,
            self.food(
                day, name="Draft", calories_kcal=None, protein_g="0", status="draft"
            ),
        )
        totals = counters(NutritionDay.objects.get(pk=day))
        self.assertEqual(totals["protein_g"]["consumed"], "30.000")
        self.assertFalse(totals["protein_g"]["partial"])
        self.assertTrue(totals["calories_kcal"]["partial"])
        self.assertEqual(totals["calories_kcal"]["consumed"], "200.000")

    def test_invalid_complete_portion_and_nutrients(self):
        day = self.day()
        for changes in [
            {"protein_g": None},
            {"portion_g": "0"},
            {"calories_kcal": "-1"},
            {"status": "estimated"},
        ]:
            self.assertEqual(
                self.mutate(FoodAdapter, self.food(day, **changes))[1][0], "rejected"
            )

    def test_snapshot_independence_explicit_correction(self):
        target = {
            "effective_date": "2025-12-01",
            "goal": "cutting",
            "calories_kcal": "2500",
            "protein_g": "150",
            "carbs_g": "300",
            "fat_g": "60",
        }
        tid, _ = self.mutate(TargetAdapter, target)
        day = self.day()
        self.mutate(
            TargetAdapter, {**target, "calories_kcal": "3000"}, tid, 1, "update"
        )
        self.assertEqual(
            NutritionDay.objects.get(pk=day).calorie_target, Decimal("2500")
        )
        self.mutate(
            DayAdapter,
            {"local_date": "2026-01-01", "calorie_target": "2600"},
            day,
            1,
            "update",
        )
        self.assertEqual(
            NutritionDay.objects.get(pk=day).calorie_target, Decimal("2600")
        )
        self.assertEqual(
            NutritionTarget.objects.get(pk=tid).calories_kcal, Decimal("3000")
        )

    def test_owner_indirect_authorization_and_catalog_admin(self):
        day = self.day()
        eid, _ = self.mutate(FoodAdapter, self.food(day))
        self.other.is_catalog_admin = True
        self.other.save()
        self.assertIsNone(FoodAdapter.read(self.other, eid))
        self.assertEqual(
            self.mutate(FoodAdapter, self.food(day), user=self.other)[1][0], "rejected"
        )
        self.client.force_login(self.other)
        self.assertEqual(
            self.client.get(f"/api/nutrition/entries/{eid}/").status_code, 404
        )

    def test_move_updates_both_totals_and_delete_tombstone(self):
        old = self.day()
        dest = self.day("2026-01-02")
        eid, _ = self.mutate(FoodAdapter, self.food(old))
        self.mutate(FoodAdapter, self.food(dest), eid, 1, "update")
        self.assertFalse(
            counters(NutritionDay.objects.get(pk=old))["calories_kcal"]["observed"]
        )
        self.assertEqual(
            counters(NutritionDay.objects.get(pk=dest))["calories_kcal"]["consumed"],
            "200.000",
        )
        self.mutate(FoodAdapter, {}, eid, 2, "delete")
        self.assertEqual(
            self.mutate(FoodAdapter, self.food(dest), eid, 3, "update")[1][1]["code"],
            "entity_deleted",
        )

    def test_day_canonicalization_and_idempotent_receipts(self):
        first = self.day()
        second = uuid.uuid4()
        device = Device.objects.create(user=self.user)
        op = {
            "idempotency_key": uuid.uuid4(),
            "entity_type": "nutrition_day",
            "entity_id": second,
            "action": "create",
            "base_revision": 0,
            "payload": {"local_date": "2026-01-01"},
        }
        result = replay(self.user, device.pk, [op])[0]
        self.assertEqual(result["canonical_id"], str(first))
        self.assertEqual(result["current"]["id"], str(first))
        self.assertEqual(replay(self.user, device.pk, [op])[0], result)
        self.assertEqual(NutritionDay.objects.count(), 1)

    def test_food_replay_retry_is_exactly_once(self):
        day = self.day()
        device = Device.objects.create(user=self.user)
        op = {
            "idempotency_key": uuid.uuid4(),
            "entity_type": "food_entry",
            "entity_id": uuid.uuid4(),
            "action": "create",
            "base_revision": 0,
            "payload": self.food(day),
        }
        self.assertEqual(replay(self.user, device.pk, [op])[0]["status"], "accepted")
        self.assertEqual(replay(self.user, device.pk, [op])[0]["status"], "accepted")
        self.assertEqual(FoodEntry.objects.count(), 1)

    def test_conflict_preserves_authoritative_and_change(self):
        day = self.day()
        eid, _ = self.mutate(FoodAdapter, self.food(day))
        self.mutate(FoodAdapter, self.food(day, calories_kcal="300"), eid, 1, "update")
        self.assertEqual(
            self.mutate(
                FoodAdapter, self.food(day, calories_kcal="500"), eid, 1, "update"
            )[1][0],
            "conflict",
        )
        self.assertEqual(FoodEntry.objects.get(pk=eid).calories_kcal, 300)
        self.assertEqual(
            ChangeRecord.objects.filter(entity_type="food_entry").count(), 2
        )

    def test_pg_constraints_active_uniqueness_and_ranges(self):
        day = self.day()
        with self.assertRaises(IntegrityError), transaction.atomic():
            NutritionDay.objects.create(
                user=self.user, local_date="2026-01-01", goal_snapshot="cutting"
            )
        with self.assertRaises(IntegrityError), transaction.atomic():
            FoodEntry.objects.create(day_id=day, name="x", portion_g=0, status="draft")

    def test_history_logged_denominator_over_target_and_no_observation(self):
        day = self.day()
        self.mutate(
            DayAdapter,
            {"local_date": "2026-01-01", "calorie_target": "100"},
            day,
            1,
            "update",
        )
        self.mutate(FoodAdapter, self.food(day))
        self.day("2026-01-02")
        data = self.client.get("/api/nutrition/history/?date=2026-01-01").json()
        self.assertEqual(data["logged_days"], 1)
        self.assertEqual(Decimal(data["averages"]["calories_kcal"]), 200)
        self.assertEqual(
            counters(NutritionDay.objects.get(pk=day))["calories_kcal"]["remaining"],
            "-100.000",
        )

    def test_future_logs_rejected_and_timezone_preserves_dates(self):
        self.assertEqual(
            self.mutate(DayAdapter, {"local_date": "2099-01-01"})[1][1]["code"],
            "future_day",
        )
        day = self.day()
        self.user.profile.timezone = "Pacific/Auckland"
        self.user.profile.save()
        self.assertEqual(str(NutritionDay.objects.get(pk=day).local_date), "2026-01-01")

    def test_rest_revision_and_lifecycle(self):
        day = self.day()
        eid, _ = self.mutate(FoodAdapter, self.food(day, notes="private note"))
        self.assertEqual(
            self.client.patch(
                f"/api/nutrition/entries/{eid}/",
                {"revision": 1, "payload": self.food(day)},
                format="json",
            ).status_code,
            200,
        )
        self.assertEqual(len(export_data(self.user)["food_entry"]), 1)
        json.dumps(export_data(self.user))
        with transaction.atomic():
            erase_data(self.user)
        row = FoodEntry.objects.get(pk=eid)
        self.assertIsNotNone(row.deleted_at)
        self.assertEqual(row.name, "")
        self.assertEqual(row.notes, "")
        self.assertEqual(export_data(self.user)["food_entry"], [])


class NutritionConcurrencyTests(TransactionTestCase):
    def test_same_date_creation_serializes_and_both_foods_survive(self):
        user = User.objects.create_user(
            email="parallel@example.com", password="nutrition-test-pass!"
        )

        def create(index):
            close_old_connections()
            try:
                owner = User.objects.get(pk=user.pk)
                identifier = uuid.uuid4()
                with transaction.atomic():
                    status, result = DayAdapter.apply(
                        owner,
                        {
                            "entity_id": identifier,
                            "action": "create",
                            "base_revision": 0,
                            "payload": {"local_date": "2026-01-01"},
                        },
                    )
                    canonical = result.get("canonical_id", identifier)
                    food_status, _ = FoodAdapter.apply(
                        owner,
                        {
                            "entity_id": uuid.uuid4(),
                            "action": "create",
                            "base_revision": 0,
                            "payload": {
                                "day": str(canonical),
                                "name": f"Meal {index}",
                                "portion_g": "150",
                                "calories_kcal": "200",
                                "protein_g": "30",
                                "carbs_g": "0",
                                "fat_g": "0",
                                "status": "complete",
                            },
                        },
                    )
                    return status, food_status, str(canonical)
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(create, [1, 2]))
        self.assertTrue(all(r[:2] == ("accepted", "accepted") for r in results))
        self.assertEqual(results[0][2], results[1][2])
        self.assertEqual(NutritionDay.objects.count(), 1)
        self.assertEqual(FoodEntry.objects.count(), 2)
