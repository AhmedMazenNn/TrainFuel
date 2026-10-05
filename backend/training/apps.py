from django.apps import AppConfig


class TrainingConfig(AppConfig):
    name = "training"

    def ready(self):
        from sync.registry import register
        from .services import ExerciseAdapter, AnnotationAdapter, FolderAdapter, RecordAdapter, OrderAdapter
        register("exercise", ExerciseAdapter)
        register("exercise_annotation", AnnotationAdapter)
        register("workout_folder", FolderAdapter)
        register("exercise_record", RecordAdapter)
        register("workout_order", OrderAdapter)
