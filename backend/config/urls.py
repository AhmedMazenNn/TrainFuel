from django.contrib import admin
from django.urls import include, path

from .views import health
from privacy.views import ErasedSessionView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health, name="health"),
    path("api/auth/me/", ErasedSessionView.as_view(), name="erased-session"),
    path("api/", include("accounts.urls")),
    path("api/sync/", include("sync.urls")),
    path("api/nutrition/", include("nutrition.urls")),
    path("api/progress/", include("progress.urls")),
    path("api/media/", include("media_assets.urls")),
    path("api/privacy/", include("privacy.urls")),
    path("api/training/", include("training.urls")),
]
