# TrainFuel development guidance

## Product and sources of truth

TrainFuel is a personal workout, manual nutrition, and private body-progress tracker. Phase 1 is a responsive website and shared backend. React Native Android/iOS clients belong to a later phase; website delivery must not depend on native builds.

- Read [docs/prd.md](docs/prd.md) for product behavior, scope, and acceptance criteria.
- Read [docs/schema.dbml](docs/schema.dbml) for the 27-table logical schema, relationships, and constraint notes. It is a diagram, not a deployable migration.
- Inspect code for what actually exists. Requirements and prototype behavior are not proof that a feature is implemented.
- Surface contradictions affecting the requested work. Preserve confirmed requirements; label proposed defaults and avoid silently turning them into confirmed decisions.

## Current repository

- `frontend/` is the minimal React 18, TypeScript, Vite scaffold, with no product UI or domain persistence yet. Its root manifest defines development commands.
- `backend/` contains Django/DRF settings, PostgreSQL configuration, a UUID email-based account foundation, initial migrations, tests, and `/api/health/`. Domain APIs, profile provisioning, external identity linking, and the full 27-table schema are not implemented.
- `compose.yaml` provides PostgreSQL 16 on loopback port 5433 with a persistent volume. `.env.example` documents configuration; root `.env` contains local secrets and must stay untracked.
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

The build includes TypeScript checking. No frontend lint or automated behavior-test runner is configured in the minimal scaffold. Run backend checks from the repository root:

```bash
backend/.venv/bin/python backend/manage.py check
backend/.venv/bin/python backend/manage.py makemigrations --check --dry-run
backend/.venv/bin/python backend/manage.py test accounts config
```

Tests require PostgreSQL and create a separate test database. For behavior changes, select meaningful scenarios from PRD section 11 and the relevant skill; report checks actually run and any blockers. Documentation-only changes require skill validation and reference review rather than application dependency installation. See [README.md](README.md) for setup.

When adopting the prototype, preserve its English/Arabic translations and RTL behavior unless scope changes; bilingual scope is still a PRD assumption. Monday–Sunday weeks, one tutorial URL per exercise, one body-weight entry per day, 10 MB original photos, and 30-day backup retention are working defaults. Document their provisional status when making related decisions. Media sourcing/license rights and release performance budgets remain unresolved.
