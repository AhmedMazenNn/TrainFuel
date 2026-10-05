from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [("progress", "0002_progress_checks")]
    operations = [
        migrations.RunSQL(
            f"ALTER TABLE progress_{table} ADD CONSTRAINT progress_{table}_revision CHECK (revision >= 1)",
            f"ALTER TABLE progress_{table} DROP CONSTRAINT progress_{table}_revision",
        )
        for table in ["weightentry", "progressweek", "progressphoto", "reminder"]
    ]
