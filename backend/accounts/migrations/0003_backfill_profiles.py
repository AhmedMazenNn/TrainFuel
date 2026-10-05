from django.db import migrations


def create_existing_profiles(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    Profile = apps.get_model("accounts", "Profile")
    database = schema_editor.connection.alias
    for user_id in User.objects.using(database).values_list("pk", flat=True).iterator():
        Profile.objects.using(database).get_or_create(user_id=user_id)


class Migration(migrations.Migration):
    dependencies = [("accounts", "0002_profile_authidentity")]
    operations = [migrations.RunPython(create_existing_profiles, migrations.RunPython.noop)]
