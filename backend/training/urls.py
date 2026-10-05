from django.urls import path
from .views import CollectionView, DetailView, OptionsView, DownloadView, ReorderView, AuditView

urlpatterns = [
    path("options/", OptionsView.as_view()),
    path("catalog-audit/", AuditView.as_view()),
    path("folders/reorder/", ReorderView.as_view()),
    path("folders/<uuid:entity_id>/download/", DownloadView.as_view()),
]
for resource in ["exercises", "annotations", "folders", "records"]:
    urlpatterns += [path(f"{resource}/", CollectionView.as_view(), {"resource": resource}), path(f"{resource}/<uuid:entity_id>/", DetailView.as_view(), {"resource": resource})]
