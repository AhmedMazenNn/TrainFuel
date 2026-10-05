from django.contrib.auth import get_user_model
from django.db import transaction
from django.http import JsonResponse


class OwnerWriteGateMiddleware:
    """Serialize every signed-in API mutation with privacy export and erasure."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if (not request.path.startswith("/api/") or request.method not in {"POST", "PUT", "PATCH", "DELETE"} or not request.user.is_authenticated):
            return self.get_response(request)
        with transaction.atomic():
            user = get_user_model().objects.select_for_update().filter(pk=request.user.pk, is_active=True).first()
            if user is None:
                return JsonResponse({"detail": "This account is unavailable.", "code": "account_unavailable"}, status=403)
            # Replace the lazy session user with the locked, current database row.
            request.user = user
            request._cached_user = user
            return self.get_response(request)
