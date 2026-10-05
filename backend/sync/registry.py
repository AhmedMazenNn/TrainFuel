"""Domain adapters are registered by AppConfig.ready(); see docs/integration/milestone-2.md."""
adapters = {}


def register(entity_type, adapter):
    if entity_type in adapters and adapters[entity_type] is not adapter:
        raise RuntimeError(f"Duplicate sync adapter: {entity_type}")
    adapters[entity_type] = adapter
