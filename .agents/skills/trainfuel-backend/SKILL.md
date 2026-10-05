---
name: trainfuel-backend
description: Implement or review TrainFuel account and domain APIs, authorization, validation, and transactional services using the PRD's proposed Django/DRF backend. Use for backend behavior, with schema, sync, and media guidance loaded when relevant.
---

# TrainFuel backend development

## Establish actual infrastructure

Read [AGENTS.md](../../../AGENTS.md), affected requirements in [the PRD](../../../docs/prd.md), and corresponding tables in [the DBML](../../../docs/schema.dbml). PRD sections 6, 9, and 11 define sync, engineering boundaries, and acceptance.

The backend baseline contains a Django/DRF scaffold, PostgreSQL configuration, a UUID account model, and a health endpoint; domain APIs are not yet implemented. Before describing runnable services, inspect what has since been implemented. Treat Django/DRF/PostgreSQL as the proposed starting point; add infrastructure only within the requested work. Use Django authentication facilities for password hashing and recovery rather than implementing password cryptography from the diagram's `password_hash` field.

## Service and authorization boundaries

Use a modular monolith with accounts, exercises, workouts, nutrition, progress, reminders, media, and sync boundaries as those capabilities are implemented. Keep domain rules reusable by normal API calls and sync replay; keep side effects and aggregate writes transactional.

- Derive account ownership from the authenticated principal. Scope queries, writes, parent-child relationships, media delivery, and replayed operations to that owner. Validate referenced private exercises, folder contexts, target sources, weeks, and assets rather than trusting identifiers supplied by clients.
- Shared catalog changes require catalog-admin permission and metadata audit. That role grants no access to private logs, annotations, custom media, or progress galleries. Archived exercises remain readable through authorized historical references but cannot be newly selected.
- Registration, new-device login, recovery, and identity linking require connectivity. Verify provider identity before linking methods; never merge accounts using unverified email text. Device registration is not authorization.
- Preserve portion nutrient totals, nullable draft values, nonnegative validation, and independent daily target snapshots. Never estimate targets or replace stored calories with inferred macro calories.
- Keep performed/reference records separate from planned sets. Child set mutations update the parent revision; finalized records contain at least one active set. Folder removal preserves history.
- Paginate growing catalog/history/folder collections. Preserve explicit local dates, stored week assignments, and normalized weights; profile timezone changes affect future schedules rather than moving historical data.

Load [trainfuel-data-model](../trainfuel-data-model/SKILL.md) for migrations and constraints, [trainfuel-offline-sync](../trainfuel-offline-sync/SKILL.md) for replay/change feeds, and [trainfuel-private-media](../trainfuel-private-media/SKILL.md) for uploads or asset access. Define API types and error behavior as part of the requested feature; no endpoint or wire schema is established by this skill.

Do not include private payloads, nutrition values, notes, tutorial URLs, or signed media URLs in analytics/audits/error logs. Browser reminders are best-effort; do not imply email/SMS or native scheduling exists.

## Acceptance checks

When backend tests exist, use its documented runner and PostgreSQL for behavior dependent on PostgreSQL constraints/locking. Add meaningful tests for the implemented boundary:

- Another owner cannot read, update, delete, or attach personal records or indirect references; a catalog admin also cannot browse them.
- Invalid nutrient values and incomplete finalized food entries are rejected; zero remains valid; historical targets are unchanged without an explicit correction.
- Set corrections preserve prescriptions and update the parent revision; folder deletion preserves records.
- Verified identity linking, archived catalog references, and pagination behave according to the implemented contract.

Report missing backend scaffolding or test infrastructure accurately rather than inventing working commands or readiness claims.
