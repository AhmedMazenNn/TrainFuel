from django.apps import AppConfig


class MediaAssetsConfig(AppConfig):
    name = "media_assets"

    def ready(self):
        from sync.registry import register
        from .services import MediaAdapter
        register("media_asset", MediaAdapter)
