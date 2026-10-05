---
name: trainfuel-data-model
description: Translate or evolve TrainFuel's DBML into Django models and PostgreSQL migrations with active uniqueness, domain constraints, ownership relationships, and historical integrity. Use for schema work rather than ordinary UI changes.
---

# TrainFuel data model

Read [AGENTS.md](../../../AGENTS.md), [the DBML](../../../docs/schema.dbml), and [PRD sections 8–9](../../../docs/prd.md). The DBML describes 27 logical tables. Its index notes, table notes, and relationship actions contain requirements beyond the diagram syntax; inspect the full affected aggregate, not just columns.

## Migration rules

- Translate active uniqueness notes into PostgreSQL partial unique indexes/conditional constraints with `WHERE deleted_at IS NULL`. Ordinary DBML indexes deliberately do not enforce these rules. Keep true global unique constraints, such as external provider identities, storage object keys, and idempotency keys, distinct from active uniqueness.
- Add explicit CHECK constraints for value ranges and row-level visibility/owner rules. Use service transactions or justified triggers for cross-table ownership, asset attachment exclusivity, and aggregate conditions that a row CHECK cannot express.
- Use UUID domain identifiers compatible with offline creation, decimal persistent weights/nutrients, timezone-aware event timestamps, explicit local dates, and stored week-start dates. Preserve nullable unknown nutrients and targets rather than converting them to zero.
- Preserve revisions and soft-delete tombstones on syncable records. Respect conservative physical-delete relationships; optional record folder context and source targets can be cleared without erasing historical records or target snapshots.
- Match authentication models to Django's supported facilities while retaining the logical identity/profile requirements. Create profiles transactionally and implement case-insensitive email uniqueness/canonicalization explicitly.

## Aggregate invariants

- Nutrition days are active-unique by owner/date. Targets have effective dates; day target snapshots remain independently editable. Food totals are sums of active entries for the complete eaten portions; completed entries require all four nutrients, positive portion weight, and nonnegative known values.
- Ordered active exercise attachments and sets have positive positions and the DBML's scoped uniqueness. Repeated exercise selections within a folder are allowed. Planned and recorded sets remain separate; changing recorded children bumps the parent revision.
- Published exercises require an active translation with ordered instructions. Private exercise references and media must belong to the aggregate owner. Tutorial annotations are active-unique per owner/exercise and never fields on the shared catalog record.
- Progress weeks are active-unique by owner/stored week start. Active photo slots have `1 <= slot <= 4` and active uniqueness by week/slot; accepted asset attachments are active-unique. Slot allocation and moves lock relevant weeks transactionally; cross-table asset exclusivity needs explicit enforcement.
- `change_record` is append-only with a global sequence and no entity foreign key, preserving tombstones. Owner scope requires an owner; catalog scope requires a null owner. Filtered sequence gaps are expected.
- Server `sync_operation` records are receipts, not client queues. Mutation, change record, and receipt must commit together. Media uploads are server lifecycle records, not accepted offline photo drafts.

For schema evolution, inspect existing data and migrations before selecting backfills. Preserve historical rows, snapshots, and identifiers. Do not regenerate the whole schema or alter the PRD/DBML unless the task requests that change or requires an agreed contract update.

## Acceptance checks

Validate migrations on PostgreSQL with actual constraints and transactions:

- Duplicate active owner/date, annotation, ordered position, or photo slot fails; the corresponding soft-deleted row does not block an allowed replacement.
- CHECK constraints reject invalid ranges, visibility/owner combinations, and invalid change scopes; unknown draft nutrients remain nullable.
- Concurrent photo finalization cannot accept a fifth photo, and failed reassignment preserves the original attachment.
- Parent revisions change with child edits; folder deletion and timezone/target changes preserve historical meaning.
- Existing rows survive migration/backfill and the documented forward/rollback strategy where supported.

Load [trainfuel-offline-sync](../trainfuel-offline-sync/SKILL.md) or [trainfuel-private-media](../trainfuel-private-media/SKILL.md) when implementing those transactions.
