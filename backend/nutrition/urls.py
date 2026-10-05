from django.urls import path
from .views import TargetView, DayView, FoodView, HistoryView

urlpatterns = [path("history/", HistoryView.as_view())]
for prefix, view in [("targets", TargetView), ("days", DayView), ("entries", FoodView)]:
    urlpatterns += [
        path(f"{prefix}/", view.as_view()),
        path(f"{prefix}/<uuid:entity_id>/", view.as_view()),
    ]
