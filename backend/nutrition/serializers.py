from decimal import Decimal
from rest_framework import serializers
from accounts.serializers import StrictSerializer
from .models import NutritionTarget, NutritionDay, FoodEntry, NUTRIENTS, TARGETS


class TargetSerializer(serializers.ModelSerializer):
    class Meta:
        model = NutritionTarget
        exclude = ["user", "deleted_at"]


class DaySerializer(serializers.ModelSerializer):
    source_target = serializers.UUIDField(
        source="source_target_id", allow_null=True, read_only=True
    )

    class Meta:
        model = NutritionDay
        exclude = ["user", "deleted_at"]


class FoodSerializer(serializers.ModelSerializer):
    day = serializers.UUIDField(source="day_id", read_only=True)

    class Meta:
        model = FoodEntry
        exclude = ["deleted_at"]


class TargetInput(StrictSerializer):
    effective_date = serializers.DateField()
    goal = serializers.ChoiceField(choices=["cutting", "bulking"])
    calories_kcal = serializers.DecimalField(
        max_digits=12, decimal_places=3, min_value=0
    )
    protein_g = serializers.DecimalField(max_digits=12, decimal_places=3, min_value=0)
    carbs_g = serializers.DecimalField(max_digits=12, decimal_places=3, min_value=0)
    fat_g = serializers.DecimalField(max_digits=12, decimal_places=3, min_value=0)


class DayInput(StrictSerializer):
    local_date = serializers.DateField()
    source_target = serializers.UUIDField(allow_null=True, required=False)
    goal_snapshot = serializers.ChoiceField(
        choices=["cutting", "bulking"], required=False
    )
    calorie_target = serializers.DecimalField(
        max_digits=12, decimal_places=3, min_value=0, allow_null=True, required=False
    )
    protein_target = serializers.DecimalField(
        max_digits=12, decimal_places=3, min_value=0, allow_null=True, required=False
    )
    carb_target = serializers.DecimalField(
        max_digits=12, decimal_places=3, min_value=0, allow_null=True, required=False
    )
    fat_target = serializers.DecimalField(
        max_digits=12, decimal_places=3, min_value=0, allow_null=True, required=False
    )


class FoodInput(StrictSerializer):
    day = serializers.UUIDField()
    name = serializers.CharField(max_length=300)
    portion_g = serializers.DecimalField(
        max_digits=12, decimal_places=3, min_value=Decimal("0.001")
    )
    calories_kcal = serializers.DecimalField(
        max_digits=12,
        decimal_places=3,
        min_value=0,
        allow_null=True,
        required=False,
        default=None,
    )
    protein_g = serializers.DecimalField(
        max_digits=12,
        decimal_places=3,
        min_value=0,
        allow_null=True,
        required=False,
        default=None,
    )
    carbs_g = serializers.DecimalField(
        max_digits=12,
        decimal_places=3,
        min_value=0,
        allow_null=True,
        required=False,
        default=None,
    )
    fat_g = serializers.DecimalField(
        max_digits=12,
        decimal_places=3,
        min_value=0,
        allow_null=True,
        required=False,
        default=None,
    )
    brand_source = serializers.CharField(
        max_length=500, allow_blank=True, required=False, default=""
    )
    notes = serializers.CharField(
        max_length=10000, allow_blank=True, required=False, default=""
    )
    status = serializers.ChoiceField(choices=["draft", "complete"], default="draft")

    def validate(self, attrs):
        if attrs["status"] == "complete" and any(
            attrs.get(key) is None for key in NUTRIENTS
        ):
            raise serializers.ValidationError(
                "Completed entries require all four nutrient totals."
            )
        return attrs
