from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from accounts.views import AccountAPIView
from .models import ChangeRecord, Device, FeedState
from .registry import adapters
from .services import OperationSerializer, feed_lock, highwater, replay


class SyncAPIView(AccountAPIView):
    permission_classes = [IsAuthenticated]
    throttle_scope = "sync"

    def device(self, request, source):
        device_id = serializers.UUIDField().run_validation(source.get("device_id"))
        return get_object_or_404(Device, pk=device_id, user=request.user)


class DevicesView(SyncAPIView):
    def post(self, request):
        device_id = serializers.UUIDField().run_validation(request.data.get("device_id"))
        platform = serializers.ChoiceField(choices=["web", "android", "ios"]).run_validation(request.data.get("platform", "web"))
        with transaction.atomic():
            device, created = Device.objects.get_or_create(pk=device_id, defaults={"user": request.user, "platform": platform})
            if device.user_id != request.user.pk:
                return Response({"code": "device_unavailable"}, status=409)
        return Response({"device_id": str(device.pk), "last_ack_sequence": device.last_ack_sequence}, status=201 if created else 200)


class PushView(SyncAPIView):
    def post(self, request):
        device = self.device(request, request.data)
        operations = serializers.ListField(child=serializers.DictField(), max_length=50, allow_empty=False).run_validation(request.data.get("operations"))
        serializer = OperationSerializer(data=operations, many=True)
        serializer.is_valid(raise_exception=True)
        return Response({"results": replay(request.user, device.pk, serializer.validated_data)})


class ChangesView(SyncAPIView):
    def get(self, request):
        self.device(request, request.query_params)
        after = serializers.IntegerField(min_value=0).run_validation(request.query_params.get("after", 0))
        limit = serializers.IntegerField(min_value=1, max_value=200).run_validation(request.query_params.get("limit", 100))
        with transaction.atomic():
            feed_lock(shared=True)
            floor = FeedState.objects.filter(pk=1).values_list("retention_floor", flat=True).first() or 0
            end = highwater()
            if after < floor or after > end:
                return Response({"code": "resync_required"}, status=410)
            rows = list(ChangeRecord.objects.filter(Q(owner=request.user, scope="owner") | Q(scope="catalog"), sequence__gt=after, sequence__lte=end).order_by("sequence")[:limit + 1])
            has_more = len(rows) > limit
            events = []
            for row in rows[:limit]:
                adapter = adapters.get(row.entity_type)
                data = adapter.read(request.user, row.entity_id) if adapter and row.action != "delete" else None
                events.append({"sequence": row.sequence, "entity_type": row.entity_type, "entity_id": str(row.entity_id), "revision": row.entity_revision, "action": row.action, "data": data})
            return Response({"changes": events, "cursor": rows[limit-1].sequence if has_more else end, "has_more": has_more})


class SnapshotView(SyncAPIView):
    def get(self, request):
        self.device(request, request.query_params)
        with transaction.atomic():
            feed_lock(shared=True)
            entities = {name: adapter.snapshot(request.user) for name, adapter in adapters.items()}
            return Response({"entities": entities, "cursor": highwater()})


class AckView(SyncAPIView):
    def post(self, request):
        device = self.device(request, request.data)
        cursor = serializers.IntegerField(min_value=0).run_validation(request.data.get("cursor"))
        with transaction.atomic():
            device = Device.objects.select_for_update().get(pk=device.pk)
            if cursor < device.last_ack_sequence or cursor > highwater():
                return Response({"code": "invalid_cursor"}, status=409)
            device.last_ack_sequence = cursor
            device.save(update_fields=["last_ack_sequence", "last_seen_at"])
        return Response({"cursor": cursor})
