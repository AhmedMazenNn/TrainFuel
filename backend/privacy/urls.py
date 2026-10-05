from django.urls import path
from .views import DeletionRequestView, ErasedSessionView, ExportDownloadView, ExportRequestView, ReceiptView

urlpatterns = [path("exports/", ExportRequestView.as_view()), path("account-deletion/", DeletionRequestView.as_view()), path("jobs/<uuid:pk>/", ReceiptView.as_view()), path("jobs/<uuid:pk>/download/", ExportDownloadView.as_view()), path("session/erased/", ErasedSessionView.as_view())]
