from datetime import timedelta
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from sync.models import ChangeRecord, FeedState
from sync.services import feed_lock, highwater


class Command(BaseCommand):
    help = "Prune a contiguous feed prefix older than 30 days; expired clients must snapshot."

    def handle(self, **options):
        with transaction.atomic():
            feed_lock()
            cutoff = timezone.now() - timedelta(days=30)
            first_retained = ChangeRecord.objects.filter(changed_at__gte=cutoff).order_by("sequence").first()
            floor = first_retained.sequence - 1 if first_retained else highwater()
            state, _ = FeedState.objects.get_or_create(pk=1)
            state.retention_floor = max(state.retention_floor, floor)
            state.save()
            count, _ = ChangeRecord.objects.filter(sequence__lte=state.retention_floor).delete()
        self.stdout.write(f"Pruned {count} events; payloads and owners omitted.")
