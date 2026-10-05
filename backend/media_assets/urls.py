from django.urls import path
from .views import AccessView, AssetView, CatalogContentView, ContentUploadView, FinalizeView, InitiateView, PrivateContentView

urlpatterns = [path("uploads/", InitiateView.as_view()), path("uploads/<uuid:pk>/content/", ContentUploadView.as_view()), path("uploads/<uuid:pk>/finalize/", FinalizeView.as_view()), path("assets/<uuid:pk>/", AssetView.as_view()), path("assets/<uuid:pk>/access/", AccessView.as_view()), path("assets/<uuid:pk>/content/", PrivateContentView.as_view()), path("catalog/<uuid:pk>/content/", CatalogContentView.as_view())]
