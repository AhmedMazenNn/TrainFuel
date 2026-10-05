from decimal import Decimal
from rest_framework import serializers
from accounts.serializers import StrictSerializer


class WeightInput(StrictSerializer):
    local_date = serializers.DateField()
    weight_kg = serializers.DecimalField(
        max_digits=12, decimal_places=3, min_value=Decimal("0.001")
    )
    notes = serializers.CharField(max_length=5000, allow_blank=True, default="")


class PhotoInput(StrictSerializer):
    week_start = serializers.DateField()
    capture_date = serializers.DateField()
    asset_id = serializers.UUIDField()
    label = serializers.CharField(max_length=100, allow_blank=True, default="")
    notes = serializers.CharField(max_length=5000, allow_blank=True, default="")

    def validate_week_start(self, value):
        if value.weekday() != 0:
            raise serializers.ValidationError("Week must start on Monday.")
        return value


class ReminderInput(StrictSerializer):
    category = serializers.ChoiceField(choices=["food", "exercise", "weight", "photo"])
    local_time = serializers.TimeField()
    weekdays = serializers.ListField(
        child=serializers.IntegerField(min_value=1, max_value=7),
        min_length=1,
        max_length=7,
    )
    enabled = serializers.BooleanField()

    def validate_weekdays(self, value):
        if len(set(value)) != len(value):
            raise serializers.ValidationError("Days must be unique.")
        return sorted(value)
