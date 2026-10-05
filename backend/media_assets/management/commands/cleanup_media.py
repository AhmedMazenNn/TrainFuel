from datetime import timedelta
from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from media_assets.models import Asset, CleanupTask, Upload
from media_assets.services import cleanup_key, storage


class Command(BaseCommand):
    help = "Expire unfinished uploads and retry private/catalog object deletion. Run periodically."

    def handle(self, **options):
        with transaction.atomic():
            for upload in Upload.objects.select_for_update().select_related("asset").filter(status="pending", expires_at__lt=timezone.now()):
                cleanup_key(upload.staging_key, upload.asset.visibility)
                upload.staging_key, upload.status, upload.error_code = "", "failed", "expired"
                upload.save()
        done = 0
        for task in CleanupTask.objects.order_by("pk")[:500]:
            try:
                storage(task.visibility).delete(task.key)
            except Exception:
                CleanupTask.objects.filter(pk=task.pk).update(attempts=F("attempts") + 1)
            else:
                task.delete()
                done += 1
        self.stdout.write(f"Deleted {done} queued objects; keys and private data omitted.")
