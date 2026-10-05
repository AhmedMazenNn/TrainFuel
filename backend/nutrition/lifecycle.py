from django.utils import timezone
from datetime import date
from sync.services import record_change
from .services import TargetAdapter, DayAdapter, FoodAdapter, scope_lock


def export_data(user):
    return {
        adapter.entity_type: [row["data"] for row in adapter.snapshot(user)]
        for adapter in (TargetAdapter, DayAdapter, FoodAdapter)
    }


def erase_data(user):
    scope_lock(user)
    for adapter in (FoodAdapter, DayAdapter, TargetAdapter):
        for row in adapter.owned(user).select_for_update():
            if adapter is FoodAdapter:
                row.name = ""
                row.notes = ""
                row.brand_source = ""
                row.portion_g = 1
                row.calories_kcal = row.protein_g = row.carbs_g = row.fat_g = None
                row.status = "draft"
            elif adapter is DayAdapter:
                row.source_target = None
                row.local_date = date(1970, 1, 1)
                row.goal_snapshot = "cutting"
                row.calorie_target = row.protein_target = row.carb_target = (
                    row.fat_target
                ) = None
            else:
                row.calories_kcal = row.protein_g = row.carbs_g = row.fat_g = 0
                row.effective_date = date(1970, 1, 1)
                row.goal = "cutting"
            row.deleted_at = timezone.now()
            row.revision += 1
            row.save()
            record_change(
                adapter.entity_type, row.pk, row.revision, owner=user, deleted=True
            )
