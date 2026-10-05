import uuid
from django.conf import settings
from django.db import models
from django.db.models import Q

NUTRIENTS = ("calories_kcal", "protein_g", "carbs_g", "fat_g")
TARGETS = ("calorie_target", "protein_target", "carb_target", "fat_target")


class Record(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    revision = models.PositiveBigIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        abstract = True


class NutritionTarget(Record):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    effective_date = models.DateField()
    goal = models.CharField(
        max_length=10, choices=[("cutting", "Cutting"), ("bulking", "Bulking")]
    )
    calories_kcal = models.DecimalField(max_digits=12, decimal_places=3)
    protein_g = models.DecimalField(max_digits=12, decimal_places=3)
    carbs_g = models.DecimalField(max_digits=12, decimal_places=3)
    fat_g = models.DecimalField(max_digits=12, decimal_places=3)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "effective_date"],
                condition=Q(deleted_at__isnull=True),
                name="nutrition_target_active_date",
            ),
            models.CheckConstraint(
                condition=Q(goal__in=["cutting", "bulking"]) & Q(revision__gte=1),
                name="nutrition_target_valid",
            ),
        ] + [
            models.CheckConstraint(
                condition=Q(**{f"{key}__gte": 0}), name=f"nt_{key}_positive"
            )
            for key in NUTRIENTS
        ]


class NutritionDay(Record):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    source_target = models.ForeignKey(
        NutritionTarget, null=True, blank=True, on_delete=models.SET_NULL
    )
    local_date = models.DateField()
    goal_snapshot = models.CharField(
        max_length=10, choices=[("cutting", "Cutting"), ("bulking", "Bulking")]
    )
    calorie_target = models.DecimalField(max_digits=12, decimal_places=3, null=True)
    protein_target = models.DecimalField(max_digits=12, decimal_places=3, null=True)
    carb_target = models.DecimalField(max_digits=12, decimal_places=3, null=True)
    fat_target = models.DecimalField(max_digits=12, decimal_places=3, null=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "local_date"],
                condition=Q(deleted_at__isnull=True),
                name="nutrition_day_active_date",
            ),
            models.CheckConstraint(
                condition=Q(goal_snapshot__in=["cutting", "bulking"])
                & Q(revision__gte=1),
                name="nutrition_day_valid",
            ),
        ] + [
            models.CheckConstraint(
                condition=Q(**{f"{key}__isnull": True}) | Q(**{f"{key}__gte": 0}),
                name=f"nd_{key}_positive",
            )
            for key in TARGETS
        ]


class FoodEntry(Record):
    day = models.ForeignKey(
        NutritionDay, on_delete=models.PROTECT, related_name="entries"
    )
    name = models.CharField(max_length=300)
    portion_g = models.DecimalField(max_digits=12, decimal_places=3)
    calories_kcal = models.DecimalField(max_digits=12, decimal_places=3, null=True)
    protein_g = models.DecimalField(max_digits=12, decimal_places=3, null=True)
    carbs_g = models.DecimalField(max_digits=12, decimal_places=3, null=True)
    fat_g = models.DecimalField(max_digits=12, decimal_places=3, null=True)
    brand_source = models.CharField(max_length=500, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    status = models.CharField(
        max_length=10,
        choices=[("draft", "Draft"), ("complete", "Complete")],
        default="draft",
    )

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=Q(portion_g__gt=0) & Q(revision__gte=1),
                name="food_entry_positive_portion",
            ),
            models.CheckConstraint(
                condition=Q(status="draft")
                | (
                    Q(status="complete")
                    & Q(
                        calories_kcal__isnull=False,
                        protein_g__isnull=False,
                        carbs_g__isnull=False,
                        fat_g__isnull=False,
                    )
                ),
                name="food_entry_complete",
            ),
        ] + [
            models.CheckConstraint(
                condition=Q(**{f"{key}__isnull": True}) | Q(**{f"{key}__gte": 0}),
                name=f"fe_{key}_positive",
            )
            for key in NUTRIENTS
        ]
