from uuid import uuid4
from django.db import migrations

MUSCLES = [("chest", "Chest", "الصدر"), ("back", "Back", "الظهر"), ("shoulders", "Shoulders", "الكتف"), ("biceps", "Biceps", "العضلة ذات الرأسين"), ("triceps", "Triceps", "العضلة ثلاثية الرؤوس"), ("quadriceps", "Quadriceps", "الفخذ الأمامي"), ("hamstrings", "Hamstrings", "الفخذ الخلفي"), ("glutes", "Glutes", "الأرداف"), ("calves", "Calves", "السمانة"), ("core", "Core", "الجذع")]


def seed(apps, schema_editor):
    Muscle = apps.get_model("training", "Muscle")
    for code, en, ar in MUSCLES:
        Muscle.objects.get_or_create(code=code, defaults={"id": uuid4(), "name_translations": {"en": en, "ar": ar}})


class Migration(migrations.Migration):
    dependencies = [("training", "0001_initial")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
