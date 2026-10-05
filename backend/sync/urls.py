from django.urls import path
from .views import AckView, ChangesView, DevicesView, PushView, SnapshotView

urlpatterns = [path("devices/", DevicesView.as_view()), path("push/", PushView.as_view()), path("changes/", ChangesView.as_view()), path("snapshot/", SnapshotView.as_view()), path("ack/", AckView.as_view())]
