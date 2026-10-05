from uuid import uuid4
from rest_framework import serializers
from accounts.serializers import StrictSerializer

CATEGORIES = ["strength", "cardio", "mobility"]
EQUIPMENT = ["bodyweight", "barbell", "dumbbell", "machine", "cable", "band", "kettlebell", "other"]


class TranslationInput(StrictSerializer):
    language = serializers.ChoiceField(choices=["en", "ar"])
    name = serializers.CharField(max_length=200)
    instructions = serializers.ListField(child=serializers.CharField(max_length=2000), min_length=1, max_length=50)
    technique_notes = serializers.CharField(max_length=5000, allow_blank=True, default="")


class MuscleInput(StrictSerializer):
    code = serializers.CharField(max_length=40)
    role = serializers.ChoiceField(choices=["primary", "secondary"])


class MediaInput(StrictSerializer):
    id = serializers.UUIDField(default=uuid4)
    asset_id = serializers.UUIDField()


class ExerciseInput(StrictSerializer):
    visibility = serializers.ChoiceField(choices=["shared", "private"], default="private")
    category = serializers.ChoiceField(choices=CATEGORIES)
    equipment = serializers.ChoiceField(choices=EQUIPMENT)
    archived = serializers.BooleanField(default=False)
    translations = TranslationInput(many=True, min_length=1, max_length=2)
    muscles = MuscleInput(many=True, default=list, max_length=30)
    media = MediaInput(many=True, default=list, max_length=10)

    def validate(self, attrs):
        for field, key in [("translations", "language"), ("muscles", "code"), ("media", "asset_id")]:
            values = [item[key] for item in attrs[field]]
            if len(values) != len(set(values)):
                raise serializers.ValidationError({field: "Duplicate values are not allowed."})
        return attrs


class AnnotationInput(StrictSerializer):
    exercise_id = serializers.UUIDField()
    tutorial_url = serializers.URLField(max_length=2000, allow_blank=True, default="")
    notes = serializers.CharField(max_length=5000, allow_blank=True, default="")

    def validate_tutorial_url(self, value):
        if value and not value.startswith("https://"):
            raise serializers.ValidationError("Use an HTTPS URL.")
        return value


class SetInput(StrictSerializer):
    id = serializers.UUIDField(default=uuid4)
    weight_kg = serializers.DecimalField(max_digits=12, decimal_places=3, min_value=0)
    reps = serializers.IntegerField(min_value=1, max_value=100000)


class EntryInput(StrictSerializer):
    id = serializers.UUIDField(default=uuid4)
    exercise_id = serializers.UUIDField()
    sets = SetInput(many=True, max_length=200)

    def validate_sets(self, rows):
        if len({row["id"] for row in rows}) != len(rows):
            raise serializers.ValidationError("Duplicate set IDs.")
        return rows


class FolderInput(StrictSerializer):
    name = serializers.CharField(max_length=200)
    position = serializers.IntegerField(min_value=1)
    entries = EntryInput(many=True, max_length=1000)

    def validate_entries(self, rows):
        if len({row["id"] for row in rows}) != len(rows):
            raise serializers.ValidationError("Duplicate entry IDs.")
        ids = [s["id"] for row in rows for s in row["sets"]]
        if len(set(ids)) != len(ids):
            raise serializers.ValidationError("Duplicate set IDs.")
        return rows


class RecordInput(StrictSerializer):
    exercise_id = serializers.UUIDField()
    folder_exercise_id = serializers.UUIDField(allow_null=True, default=None)
    local_date = serializers.DateField()
    recorded_at = serializers.DateTimeField()
    kind = serializers.ChoiceField(choices=["performed", "reference"])
    notes = serializers.CharField(max_length=5000, allow_blank=True, default="")
    sets = SetInput(many=True, min_length=1, max_length=200)

    def validate_sets(self, rows):
        if len({row["id"] for row in rows}) != len(rows):
            raise serializers.ValidationError("Duplicate set IDs.")
        return rows
