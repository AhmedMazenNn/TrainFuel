from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from media_assets.models import Asset, Upload
from media_assets.services import storage


class Command(BaseCommand):
    help = "Scan dedicated staging/processed prefixes for unreferenced objects older than 24 hours. Dry run by default."

    def add_arguments(self, parser):
        parser.add_argument("--delete", action="store_true", help="Delete only confirmed, aged orphans.")

    def handle(self, **options):
        cutoff = timezone.now() - timedelta(hours=24)
        count = 0
        for visibility in ["private", "public"]:
            store = storage(visibility)
            referenced = set(Asset.objects.filter(visibility=visibility).values_list("object_key", flat=True)) | set(Asset.objects.filter(visibility=visibility).values_list("thumbnail_key", flat=True)) | set(Upload.objects.filter(asset__visibility=visibility).values_list("staging_key", flat=True))
            def scan(prefix):
                nonlocal count
                try:
                    directories, names = store.listdir(prefix)
                except FileNotFoundError:
                    return
                for directory in directories:
                    scan(f"{prefix}/{directory}")
                for name in names:
                    key = f"{prefix}/{name}"
                    if key in referenced or store.get_modified_time(key) >= cutoff:
                        continue
                    count += 1
                    if options["delete"]:
                        store.delete(key)
            scan("staging")
            scan("processed")
        self.stdout.write(f"{'Deleted' if options['delete'] else 'Found'} {count} aged orphan objects; no keys logged.")
