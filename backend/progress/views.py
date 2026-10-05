from django.db import transaction
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import serializers
from accounts.views import AccountAPIView
from sync.registry import adapters


class RecordsView(AccountAPIView):
    permission_classes = [IsAuthenticated]
    throttle_scope = "sync"

    def get(self, request, kind):
        adapter = adapters[kind]
        try:
            offset = max(0, int(request.query_params.get("offset", 0)))
            limit = min(100, max(1, int(request.query_params.get("limit", 50))))
        except ValueError:
            raise serializers.ValidationError({"code": "invalid_pagination"})
        rows = (
            adapter.owned(request.user)
            .filter(deleted_at__isnull=True)
            .order_by("-created_at")
        )
        from .services import serialize

        return Response(
            {
                "count": rows.count(),
                "results": [serialize(row) for row in rows[offset : offset + limit]],
            }
        )
