from django.apps import AppConfig


class ProgressConfig(AppConfig):
    name = "progress"

    def ready(self):
        from sync.registry import register
        from .services import WeightAdapter, PhotoAdapter, ReminderAdapter

        register("weight_entry", WeightAdapter)
        register("progress_photo", PhotoAdapter)
        register("reminder", ReminderAdapter)
