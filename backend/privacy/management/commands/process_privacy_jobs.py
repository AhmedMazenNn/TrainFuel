import time
from django.core.management.base import BaseCommand
from privacy.services import process_privacy_jobs


class Command(BaseCommand):
    help = "Process queued personal data exports, account deletions, and private-file cleanup."

    def add_arguments(self, parser):
        parser.add_argument("--once", action="store_true", help="Process one batch, then exit.")
        parser.add_argument("--interval", type=float, default=2.0)

    def handle(self, **options):
        while True:
            process_privacy_jobs()
            if options["once"]:
                return
            time.sleep(max(0.5, options["interval"]))
