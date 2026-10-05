from uuid import uuid4
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework import serializers
from rest_framework.parsers import JSONParser
from rest_framework.response import Response
from accounts.models import User
from accounts.views import AccountAPIView
from sync.services import record_change
from .models import Muscle, WorkoutFolder, CatalogAudit
from .services import ExerciseAdapter, AnnotationAdapter, FolderAdapter, RecordAdapter, OrderAdapter, accessible
from .serializers import CATEGORIES, EQUIPMENT

ADAPTERS = {"exercises": ExerciseAdapter, "annotations": AnnotationAdapter, "folders": FolderAdapter, "records": RecordAdapter}


class TrainingView(AccountAPIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = []
    parser_classes = [JSONParser]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if request.method in {"POST", "PUT", "DELETE"} and not isinstance(request.data, dict):
            raise serializers.ValidationError({"code": "invalid_payload"})


class CollectionView(TrainingView):
    def get(self, request, resource):
        adapter = ADAPTERS[resource]
        rows = adapter.rows(request.user)
        if resource == "exercises":
            if request.query_params.get("archived") != "true":
                rows = rows.filter(archived_at__isnull=True)
            if request.query_params.get("q"):
                rows = rows.filter(texts__name__icontains=request.query_params["q"], texts__deleted_at__isnull=True)
            for field in ["equipment", "category", "visibility"]:
                if request.query_params.get(field):
                    rows = rows.filter(**{field: request.query_params[field]})
            if request.query_params.get("muscle"):
                rows = rows.filter(muscles__muscle__code=request.query_params["muscle"], muscles__deleted_at__isnull=True)
            rows = rows.order_by("created_at", "id").distinct()
        elif resource == "folders":
            rows = rows.order_by("position", "id")
        else:
            if request.query_params.get("exercise_id"):
                exercise_id = serializers.UUIDField().run_validation(request.query_params["exercise_id"])
                rows = rows.filter(exercise_id=exercise_id)
            rows = rows.order_by("-local_date", "-recorded_at", "id") if resource == "records" else rows.order_by("id")
        try:
            offset = max(0, int(request.query_params.get("offset", 0)))
            limit = min(100, max(1, int(request.query_params.get("limit", 50))))
        except ValueError:
            return Response({"code": "invalid_pagination"}, status=400)
        selected = list(rows[offset:offset + limit + 1])
        return Response({"results": [adapter.serialize(row) for row in selected[:limit]], "next_offset": offset + limit if len(selected) > limit else None})

    def post(self, request, resource):
        if not isinstance(request.data, dict):
            return Response({"code": "invalid_payload"}, status=400)
        data = dict(request.data)
        entity_id = data.pop("id", uuid4())
        try:
            from uuid import UUID
            entity_id = UUID(str(entity_id))
        except ValueError:
            return Response({"code": "invalid_id"}, status=400)
        return mutate(request.user, ADAPTERS[resource], entity_id, "create", 0, data)


class DetailView(TrainingView):
    def get(self, request, resource, entity_id):
        result = ADAPTERS[resource].read(request.user, entity_id)
        return Response(result) if result else Response({"code": "not_found"}, status=404)

    def put(self, request, resource, entity_id):
        data = dict(request.data)
        revision = data.pop("revision", None)
        if type(revision) is not int or revision < 1:
            return Response({"code": "revision_required"}, status=400)
        return mutate(request.user, ADAPTERS[resource], entity_id, "update", revision, data)

    def delete(self, request, resource, entity_id):
        revision = request.data.get("revision")
        if type(revision) is not int or revision < 1:
            return Response({"code": "revision_required"}, status=400)
        return mutate(request.user, ADAPTERS[resource], entity_id, "delete", revision, {})


def mutate(user, adapter, entity_id, action, revision, payload):
    with transaction.atomic():
        status, result = adapter.apply(user, {"entity_id": entity_id, "action": action, "base_revision": revision, "payload": payload})
        current = adapter.read(user, entity_id)
    if status != "accepted":
        return Response({**result, "current": current}, status=404 if result["code"] == "not_found" else 409 if status == "conflict" else 400)
    return Response(current if current else {"id": str(entity_id), "deleted": True, **result}, status=201 if action == "create" else 200)


class OptionsView(TrainingView):
    def get(self, request):
        return Response({"categories": CATEGORIES, "equipment": EQUIPMENT, "muscles": list(Muscle.objects.filter(deleted_at__isnull=True).values("code", "name_translations")), "catalog_admin": request.user.is_catalog_admin})


class DownloadView(TrainingView):
    def get(self, request, entity_id):
        folder = FolderAdapter.read(request.user, entity_id)
        if not folder:
            return Response({"code": "not_found"}, status=404)
        ids = {entry["exercise_id"] for entry in folder["entries"]}
        exercises = [ExerciseAdapter.read(request.user, eid) for eid in ids]
        annotations = [AnnotationAdapter.serialize(row) for row in AnnotationAdapter.rows(request.user).filter(exercise_id__in=ids)]
        return Response({"folder": folder, "exercises": [row for row in exercises if row], "annotations": annotations})


class ReorderView(TrainingView):
    def post(self, request):
        revision = request.data.get("revision", 1)
        return mutate(request.user, OrderAdapter, request.user.pk, "update", revision, {"folders": request.data.get("folders")})

    def get(self, request):
        return Response(OrderAdapter.read(request.user, request.user.pk))


class AuditView(TrainingView):
    def get(self, request):
        if not request.user.is_catalog_admin:
            return Response({"code": "not_found"}, status=404)
        return Response({"results": list(CatalogAudit.objects.order_by("-created_at").values("id", "exercise_id", "actor_id", "action", "fields", "revision", "created_at")[:100])})
