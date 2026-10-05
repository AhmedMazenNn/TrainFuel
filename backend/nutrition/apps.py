from django.apps import AppConfig


class NutritionConfig(AppConfig):
    name = "nutrition"

    def ready(self):
        from sync.registry import register
        from .services import TargetAdapter, DayAdapter, FoodAdapter

        for name, adapter in [
            ("nutrition_target", TargetAdapter),
            ("nutrition_day", DayAdapter),
            ("food_entry", FoodAdapter),
        ]:
            register(name, adapter)
