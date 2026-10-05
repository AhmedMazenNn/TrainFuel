from django.contrib import admin
from django.urls import include, path

from .views import health

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health, name="health"),
    path("api/", include("accounts.urls")),
    path("api/sync/", include("sync.urls")),
    path("api/media/", include("media_assets.urls")),
    path("api/training/", include("training.urls")),
]
