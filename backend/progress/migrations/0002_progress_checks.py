from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [("progress", "0001_initial")]
    operations = [
        migrations.RunSQL(
            "ALTER TABLE progress_progressweek ADD CONSTRAINT progress_week_monday CHECK (EXTRACT(ISODOW FROM week_start)=1)",
            "ALTER TABLE progress_progressweek DROP CONSTRAINT progress_week_monday",
        ),
        migrations.RunSQL(
            "ALTER TABLE progress_reminder ADD CONSTRAINT progress_reminder_days_unique CHECK (cardinality(weekdays)>0 AND cardinality(weekdays) = (CASE WHEN 1=ANY(weekdays) THEN 1 ELSE 0 END + CASE WHEN 2=ANY(weekdays) THEN 1 ELSE 0 END + CASE WHEN 3=ANY(weekdays) THEN 1 ELSE 0 END + CASE WHEN 4=ANY(weekdays) THEN 1 ELSE 0 END + CASE WHEN 5=ANY(weekdays) THEN 1 ELSE 0 END + CASE WHEN 6=ANY(weekdays) THEN 1 ELSE 0 END + CASE WHEN 7=ANY(weekdays) THEN 1 ELSE 0 END))",
            "ALTER TABLE progress_reminder DROP CONSTRAINT progress_reminder_days_unique",
        ),
    ]
