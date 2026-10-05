import uuid
from django.conf import settings
from django.db import models
from django.db.models import Q


class Versioned(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    revision = models.PositiveBigIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        abstract = True


class Exercise(Versioned):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.PROTECT)
    visibility = models.CharField(max_length=8, choices=[("shared", "Shared"), ("private", "Private")])
    category = models.CharField(max_length=40)
    equipment = models.CharField(max_length=40)
    archived_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [models.CheckConstraint(condition=Q(visibility="shared", owner__isnull=True) | Q(visibility="private", owner__isnull=False), name="training_exercise_visibility_owner")]


class ExerciseText(Versioned):
    exercise = models.ForeignKey(Exercise, related_name="texts", on_delete=models.CASCADE)
    language = models.CharField(max_length=2, choices=[("en", "English"), ("ar", "Arabic")])
    name = models.CharField(max_length=200)
    instructions = models.JSONField()
    technique_notes = models.TextField(blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["exercise", "language"], condition=Q(deleted_at__isnull=True), name="training_text_active_language")]


class Muscle(Versioned):
    code = models.CharField(max_length=40, unique=True)
    name_translations = models.JSONField()


class ExerciseMuscle(Versioned):
    exercise = models.ForeignKey(Exercise, related_name="muscles", on_delete=models.CASCADE)
    muscle = models.ForeignKey(Muscle, on_delete=models.PROTECT)
    role = models.CharField(max_length=9, choices=[("primary", "Primary"), ("secondary", "Secondary")])

    class Meta:
        constraints = [models.UniqueConstraint(fields=["exercise", "muscle"], condition=Q(deleted_at__isnull=True), name="training_muscle_active_pair"), models.CheckConstraint(condition=Q(role__in=["primary", "secondary"]), name="training_muscle_role")]


class ExerciseMedia(Versioned):
    exercise = models.ForeignKey(Exercise, related_name="media", on_delete=models.CASCADE)
    asset = models.ForeignKey("media_assets.Asset", on_delete=models.PROTECT)
    position = models.PositiveIntegerField()

    class Meta:
        constraints = [models.UniqueConstraint(fields=["asset"], condition=Q(deleted_at__isnull=True), name="training_media_active_asset"), models.UniqueConstraint(fields=["exercise", "position"], condition=Q(deleted_at__isnull=True), name="training_media_active_position"), models.CheckConstraint(condition=Q(position__gt=0), name="training_media_position_positive")]


class Annotation(Versioned):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    exercise = models.ForeignKey(Exercise, on_delete=models.PROTECT)
    tutorial_url = models.URLField(max_length=2000, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "exercise"], condition=Q(deleted_at__isnull=True), name="training_annotation_active_pair")]


class WorkoutFolder(Versioned):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    name = models.CharField(max_length=200)
    position = models.PositiveIntegerField()

    class Meta:
        constraints = [models.CheckConstraint(condition=Q(position__gt=0), name="training_folder_position_positive")]


class FolderOrder(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, primary_key=True, on_delete=models.PROTECT)
    revision = models.PositiveBigIntegerField(default=1)


class FolderExercise(Versioned):
    folder = models.ForeignKey(WorkoutFolder, related_name="entries", on_delete=models.CASCADE)
    exercise = models.ForeignKey(Exercise, on_delete=models.PROTECT)
    position = models.PositiveIntegerField()

    class Meta:
        constraints = [models.UniqueConstraint(fields=["folder", "position"], condition=Q(deleted_at__isnull=True), name="training_folder_entry_position"), models.CheckConstraint(condition=Q(position__gt=0), name="training_entry_position_positive")]


class PlannedSet(Versioned):
    folder_exercise = models.ForeignKey(FolderExercise, related_name="sets", on_delete=models.CASCADE)
    position = models.PositiveIntegerField()
    weight_kg = models.DecimalField(max_digits=12, decimal_places=3)
    reps = models.PositiveIntegerField()

    class Meta:
        constraints = [models.UniqueConstraint(fields=["folder_exercise", "position"], condition=Q(deleted_at__isnull=True), name="training_planned_position"), models.CheckConstraint(condition=Q(position__gt=0, weight_kg__gte=0, reps__gt=0), name="training_planned_values")]


class ExerciseRecord(Versioned):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    exercise = models.ForeignKey(Exercise, on_delete=models.PROTECT)
    folder_exercise = models.ForeignKey(FolderExercise, null=True, blank=True, on_delete=models.SET_NULL)
    local_date = models.DateField()
    recorded_at = models.DateTimeField()
    kind = models.CharField(max_length=9, choices=[("performed", "Performed"), ("reference", "Reference")])
    notes = models.TextField(blank=True)

    class Meta:
        indexes = [models.Index(fields=["user", "exercise", "local_date"])]
        constraints = [models.CheckConstraint(condition=Q(kind__in=["performed", "reference"]), name="training_record_kind")]


class RecordedSet(Versioned):
    record = models.ForeignKey(ExerciseRecord, related_name="sets", on_delete=models.CASCADE)
    position = models.PositiveIntegerField()
    weight_kg = models.DecimalField(max_digits=12, decimal_places=3)
    reps = models.PositiveIntegerField()

    class Meta:
        constraints = [models.UniqueConstraint(fields=["record", "position"], condition=Q(deleted_at__isnull=True), name="training_recorded_position"), models.CheckConstraint(condition=Q(position__gt=0, weight_kg__gte=0, reps__gt=0), name="training_recorded_values")]


class CatalogAudit(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    exercise = models.ForeignKey(Exercise, on_delete=models.PROTECT)
    action = models.CharField(max_length=20)
    fields = models.JSONField(default=list)
    revision = models.PositiveBigIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)
