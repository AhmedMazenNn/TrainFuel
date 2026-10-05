import uuid
from decimal import Decimal
from datetime import timedelta
from django.db import transaction
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from accounts.views import AccountAPIView
from accounts.serializers import StrictSerializer
from rest_framework import serializers
from .services import TargetAdapter, DayAdapter, FoodAdapter, counters, today
from .models import NutritionDay


class Envelope(StrictSerializer):
    id = serializers.UUIDField(required=False)
    revision = serializers.IntegerField(min_value=0, required=False)
    payload = serializers.DictField()


class NutritionView(AccountAPIView):
    permission_classes = [IsAuthenticated]
    throttle_scope = "profile"

    def get(self, request, entity_id=None):
        if entity_id:
            data = self.adapter.read(request.user, entity_id)
            return Response(
                data if data else {"code": "not_found"}, status=200 if data else 404
            )
        rows = (
            self.adapter.owned(request.user)
            .filter(deleted_at__isnull=True)
            .order_by("-created_at", "id")
        )
        offset = (
            max(0, int(request.query_params.get("offset", "0")))
            if request.query_params.get("offset", "0").isdigit()
            else 0
        )
        return Response(
            {
                "results": self.adapter.output(
                    rows[offset : offset + 100], many=True
                ).data,
                "next_offset": offset + 100 if rows.count() > offset + 100 else None,
            }
        )

    def mutate(self, request, action, entity_id=None):
        if action == "delete":
            if (
                set(request.data) != {"revision"}
                or not isinstance(request.data["revision"], int)
                or request.data["revision"] < 1
            ):
                return Response({"code": "invalid_payload"}, status=400)
            revision = request.data["revision"]
            payload = {}
        else:
            serializer = Envelope(data=request.data)
            serializer.is_valid(raise_exception=True)
            value = serializer.validated_data
            revision = value.get("revision", 0)
            payload = value["payload"]
            if entity_id and "id" in value:
                return Response({"code": "invalid_payload"}, status=400)
            entity_id = entity_id or value.get("id") or uuid.uuid4()
        with transaction.atomic():
            status, result = self.adapter.apply(
                request.user,
                {
                    "entity_id": entity_id,
                    "base_revision": revision,
                    "payload": payload,
                    "action": action,
                },
            )
            canonical = result.get("canonical_id", entity_id)
            data = self.adapter.read(request.user, canonical)
        return Response(
            {**result, "current": data},
            status=(
                (201 if action == "create" else 200)
                if status == "accepted"
                else (
                    409
                    if status == "conflict"
                    else 404 if result["code"] == "not_found" else 400
                )
            ),
        )

    def post(self, request):
        return self.mutate(request, "create")

    def patch(self, request, entity_id):
        return self.mutate(request, "update", entity_id)

    def delete(self, request, entity_id):
        return self.mutate(request, "delete", entity_id)


class TargetView(NutritionView):
    adapter = TargetAdapter


class DayView(NutritionView):
    adapter = DayAdapter


class FoodView(NutritionView):
    adapter = FoodAdapter


class HistoryView(AccountAPIView):
    permission_classes = [IsAuthenticated]
    throttle_scope = "profile"

    def get(self, request):
        field = serializers.DateField()
        selected = field.run_validation(
            request.query_params.get("date", str(today(request.user)))
        )
        start = selected - timedelta(days=selected.weekday())
        days = NutritionDay.objects.filter(
            user=request.user,
            deleted_at__isnull=True,
            local_date__gte=start,
            local_date__lt=start + timedelta(days=7),
        ).order_by("local_date")
        observed = [
            day for day in days if day.entries.filter(deleted_at__isnull=True).exists()
        ]
        totals = {
            key: sum(
                (Decimal(counters(day)[key]["consumed"]) for day in observed),
                Decimal(0),
            )
            for key in ("calories_kcal", "protein_g", "carbs_g", "fat_g")
        }
        return Response(
            {
                "week_start": str(start),
                "logged_days": len(observed),
                "denominator": "days with at least one active entry",
                "average_partial": {
                    key: any(counters(day)[key]["partial"] for day in observed)
                    for key in totals
                },
                "averages": {
                    key: str(value / len(observed)) if observed else None
                    for key, value in totals.items()
                },
                "days": [
                    {
                        "day": DayAdapter.read(request.user, day.pk),
                        "counters": counters(day),
                    }
                    for day in days
                ],
            }
        )
