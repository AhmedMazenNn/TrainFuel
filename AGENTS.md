# TrainFuel development guidance

## Product and sources of truth

TrainFuel is a personal workout, manual nutrition, and private body-progress tracker. Phase 1 is a responsive website and shared backend. React Native Android/iOS clients belong to a later phase; website delivery must not depend on native builds.

- Read [docs/prd.md](docs/prd.md) for product behavior, scope, and acceptance criteria.
- Read [docs/schema.dbml](docs/schema.dbml) for the 27-table logical schema, relationships, and constraint notes. It is a diagram, not a deployable migration.
- Inspect code for what actually exists. Requirements and prototype behavior are not proof that a feature is implemented.
- Surface contradictions affecting the requested work. Preserve confirmed requirements; label proposed defaults and avoid silently turning them into confirmed decisions.

## Current repository

- `frontend/` contains bilingual React/TypeScript/Vite account screens, durable account-partitioned IndexedDB profile saves/queues/drafts, a real sync/conflict screen, staged media helpers, and a production cached shell. Domain records need their own adapters and verification. Its root manifest defines development commands.
- `backend/` contains account and privacy lifecycle APIs, transactional sync replay/feed/cursor APIs, private/public-separated media processing/delivery, and domain apps for training, nutrition, and progress. Read [integration contracts](docs/integration/milestone-2.md) before changing sync or media. Live Google/SMTP/S3 need external settings. The DBML remains a logical schema rather than a deployable migration.
- `training` adds owner-authorized shared/private exercise aggregates, private tutorial annotations, ordered folder prescriptions, separate dated lifting records, revisioned atomic folder ordering, and explicit account-scoped offline media downloads. Read [training API](docs/training-api.md) for sync and lifecycle hooks. Catalog media rights remain an external content requirement.
- `nutrition` provides manual nutrition targets, daily snapshots, food logging, history, and canonical-day reconciliation. Read [nutrition API](docs/nutrition-api.md) for sync and lifecycle hooks.
- `progress` adds weight history, weekly private photos, comparisons and best-effort reminders, with domain sync adapters. Read [progress API](docs/progress-api.md) for photo slot/cache/lifecycle integration.
- `compose.yaml` provides PostgreSQL 16 on loopback port 5433 for local development. `docker-compose.yml` provides the production API, web, database, media, and privacy-worker stack. Use `-f` explicitly because both files are present. `.env.example` and `.env.production.example` are templates; `.env` contains local secrets and stays untracked.
- The original AI-generated UI is preserved only on `feature/generated-ui` under `frontend/prototype/`. It contains React/Tailwind components, domain contexts/types/utilities, English/Arabic translations, localStorage adapters, simulated sync, and data-URL photos with a 1.5 MB client limit. These are design references, not production guarantees.

## Branch workflow

- `main` contains the clean setup baseline. Do not add the generated UI or ordinary feature work directly to it.
- `dev` is the development integration branch. Start each new change from its current committed state.
- Before implementation, create `feature/<short-name>` for capabilities or `fix/<short-name>` for fixes. Merge reviewed changes into `dev` through a pull request. Start a fresh branch for unrelated work.
- Preserve `feature/generated-ui` as a reference until the user chooses to adopt/redesign it. Do not merge its contents automatically.
- Promote `dev` to `main` or publish branches only when requested. These conventions do not imply Git-host branch protection is configured.

## Product invariants

- Food nutrients are totals for the entered portion. Portion weight is context and never multiplies calories or macros. Preserve explicit zero versus unknown values, partial totals, and stored calories independently of macro calculations.
- Start New Day opens today's local-date log without clearing or locking history. Historical corrections update affected totals; target snapshots, dates, and assigned weeks must not change silently after preference changes.
- Planned sets and dated performed/reference records are separate. Recording a set does not overwrite a prescription or introduce a workout-completion workflow. Folder deletion preserves lifting history.
- Normalize stored weights to kilograms and use decimals for persistent weights/nutrients. Explicit local dates and stored week starts preserve historical meaning; timezone-aware timestamps record events.
- Personal records, custom exercises, tutorial annotations, and private media require owner authorization, including through indirect relationships. Catalog-admin permissions do not grant access to personal logs or photos.
- Accepted progress photos are limited to four active photos per owner/week across devices, with authoritative transactional enforcement. Failed uploads and sync conflicts preserve recoverable local work.
- Local save and server sync are distinct. Durable saves, retry idempotency, visible conflicts, account-partitioned storage, and tombstones are foundations for the MVP, not simulated by a status label.
- Keep automatic nutrition estimates, shared food databases, AI photo analysis, social features, payments, and native clients outside the initial website scope unless explicitly requested.

## Project skills

Load the skill relevant to the task; read additional skills only when their boundaries are involved.

| Skill | Use for |
| --- | --- |
| [trainfuel-web](.agents/skills/trainfuel-web/SKILL.md) | React interfaces, domain editors, accessibility, localization, and responsive behavior |
| [trainfuel-backend](.agents/skills/trainfuel-backend/SKILL.md) | Accounts, domain APIs, authorization, validation, and backend service boundaries |
| [trainfuel-data-model](.agents/skills/trainfuel-data-model/SKILL.md) | DBML interpretation, PostgreSQL constraints, models, and migrations |
| [trainfuel-offline-sync](.agents/skills/trainfuel-offline-sync/SKILL.md) | Durable local persistence, queues, reconciliation, conflicts, and account switching |
| [trainfuel-private-media](.agents/skills/trainfuel-private-media/SKILL.md) | Uploads, private photo access, weekly slots, media caching, and cleanup |

## Verification and defaults

Run frontend checks from `frontend/` after `npm ci`:

```bash
npm run typecheck
npm run build
```

The build includes TypeScript checking. No frontend lint script is configured; Playwright checks desktop/mobile account flows via `npm run test:e2e`. See docs/accounts-api.md for browser setup and Postman usage. Run backend checks from the repository root:

```bash
backend/.venv/bin/python backend/manage.py check
backend/.venv/bin/python backend/manage.py makemigrations --check --dry-run
backend/.venv/bin/python backend/manage.py test accounts config sync media_assets training
```

Tests require PostgreSQL and create a separate test database. For behavior changes, select meaningful scenarios from PRD section 11 and the relevant skill; report checks actually run and any blockers. Documentation-only changes require skill validation and reference review rather than application dependency installation. See [README.md](README.md) for setup.

When adopting the prototype, preserve its English/Arabic translations and RTL behavior unless scope changes; English/Arabic scope is confirmed by the user. Monday–Sunday weeks, one tutorial URL per exercise, one body-weight entry per day, 10 MB original photos, and 30-day backup retention are working defaults. Document their provisional status when making related decisions. Media sourcing/license rights and release performance budgets remain unresolved.
