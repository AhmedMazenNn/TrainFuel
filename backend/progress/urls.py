from django.urls import path
from .views import RecordsView

urlpatterns = [
    path("weights/", RecordsView.as_view(), {"kind": "weight_entry"}),
    path("photos/", RecordsView.as_view(), {"kind": "progress_photo"}),
    path("reminders/", RecordsView.as_view(), {"kind": "reminder"}),
]
