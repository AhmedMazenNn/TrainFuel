# TrainFuel

A website-first workout, manual nutrition, and private progress tracker. Accounts, offline synchronization, training, nutrition, progress, privacy controls, and a production deployment skeleton are integrated on `feature/milestone-6`. React Native remains a later phase. The release still requires staging checks for the live host, media rights, performance budgets, and an executed backup restore.

For authentication setup, endpoint contracts, and the Postman JSON files, see [Milestone 1 accounts/API documentation](docs/accounts-api.md).

See the [sync API](docs/sync-api.md), [media API](docs/media-api.md), and [Milestone 2 integration contracts](docs/integration/milestone-2.md).

Training is available at `/app/training`: shared/private exercises, workout prescriptions, separate dated lifting history, and explicit offline folder/media downloads. See the [training API](docs/training-api.md), [Milestone 3 validation](docs/milestone-3-validation.md), and [training Postman collection](docs/postman/TrainFuel.milestone-3.postman_collection.json). Shared catalog content starts empty until an administrator supplies approved instructions/media.

Nutrition is available at `/app/nutrition`; progress, private photos, comparison, and reminders are at `/app/progress` and `/app/reminders`. Account export and deletion controls are at `/app/privacy`. Their APIs and Postman collections are documented in [nutrition](docs/nutrition-api.md), [progress](docs/progress-api.md), [privacy](docs/postman/TrainFuel.privacy.postman_collection.json), and [training](docs/training-api.md).

See the [feature roadmap](docs/feature-roadmap.md) for milestone status and acceptance criteria. See the [release runbook](docs/release-runbook.md) for production Compose deployment, private storage, and backup/restore procedures.

## Repository layout

```text
.agents/skills/       Project-specific development guidance
backend/             Django/DRF accounts, sync, private media, PostgreSQL migrations
frontend/            React/TypeScript, bilingual screens, IndexedDB queue, cached shell
docs/prd.md          Product requirements and acceptance criteria
docs/schema.dbml     Logical database model; not a deployable migration
docs/diagrams/       Database diagram
compose.yaml         Local PostgreSQL service and persistent volume
docker-compose.yml   Production web/API/PostgreSQL/private-media stack
AGENTS.md            Contributor/agent rules and branch workflow
```

## Branch workflow

- `main`: clean application setup baseline. The generated design is excluded.
- `dev`: development integration branch and the starting point for new work.
- `feature/<short-name>`: new capabilities, created from `dev` and merged into `dev` through a pull request.
- `fix/<short-name>`: fixes, also created from and merged into `dev`.
- `feature/generated-ui`: preserves the original AI-generated frontend under `frontend/prototype/` as a design reference. It is separate from the minimal app and can be redesigned later; do not merge it automatically.

```bash
git switch dev
git switch -c feature/food-logging
# Or: git switch -c fix/daily-totals
```

Keep feature/fix work off `main`; promote reviewed development changes to `main` only when explicitly requested. Branch protection/default-branch settings are managed separately in the Git hosting service. Local branch creation does not publish branches.

To inspect the generated design after committing or stashing current work:

```bash
git switch feature/generated-ui
cd frontend/prototype
npm install
npm run dev
```

## Local setup

Requirements: Python 3.12+, Node.js 20.19+ or 22.12+, and Docker with Compose (or Podman with a compatible Compose provider). The database uses the [official PostgreSQL image](https://hub.docker.com/_/postgres); Django connects through [its PostgreSQL backend and psycopg](https://docs.djangoproject.com/en/6.0/ref/databases/#postgresql-notes).

Run commands from the repository root unless shown otherwise.

1. Create local configuration:

   ```bash
   cp .env.example .env
   python3 -c "import secrets; print(secrets.token_urlsafe(48))"
   ```

   Replace `DJANGO_SECRET_KEY` and `POSTGRES_PASSWORD` in `.env` with separate random values. `.env` is ignored by Git. The defaults bind PostgreSQL to `127.0.0.1:5433`, leaving a host database on port 5432 untouched.

2. Start PostgreSQL:

   ```bash
   docker compose -f compose.yaml up -d db
   docker compose -f compose.yaml ps
   ```

   On Linux with Podman and the Docker Compose compatibility provider, start the user socket and point Compose at it:

   ```bash
   systemctl --user start podman.socket
   export DOCKER_HOST="unix://${XDG_RUNTIME_DIR}/podman/podman.sock"
   docker compose -f compose.yaml up -d db
   ```

   Wait for the database to become healthy. The named volume retains data when the service stops. After initialization, changing credentials in `.env` does not change an existing database role automatically.

3. Install backend dependencies and migrate:

   ```bash
   python3 -m venv backend/.venv
   backend/.venv/bin/python -m pip install -r backend/requirements.txt
   backend/.venv/bin/python backend/manage.py migrate
   backend/.venv/bin/python backend/manage.py runserver 127.0.0.1:8000
   ```

   `http://127.0.0.1:8000/api/health/` returns `{"status":"ok"}` when the database is reachable, or HTTP 503 when unavailable. Migrations establish accounts plus sync/media foundations; they do not implement all 27 DBML domain tables. Optionally create a local admin with `backend/.venv/bin/python backend/manage.py createsuperuser`.

4. In another terminal, start the frontend:

   ```bash
   cd frontend
   npm ci
   npm run dev
   ```

   Open the URL printed by Vite. `/api` requests are proxied to the local backend during development.

   Offline shell restart uses the production build: `npm run build`, then `npm run preview`. HMR development is uncached. Both development and preview proxy `/api`; set `TRAINFUEL_API_TARGET` for an alternate backend port. Production hosting must route `/api` to Django and serve `sw.js` without long-lived HTTP caching.

   For parallel milestone terminals, use separate Git worktrees, databases, virtual environments, and ports. This milestone uses `/tmp/trainfuel-milestone-2`, database `trainfuel_milestone2`, API 18000, and web 15173. It leaves the shared checkout and original database untouched. Set `FRONTEND_URL` and `CSRF_TRUSTED_ORIGINS` to your web origin in that worktree's ignored `.env`.

## Checks

```bash
backend/.venv/bin/python backend/manage.py check
backend/.venv/bin/python backend/manage.py makemigrations --check --dry-run
backend/.venv/bin/python backend/manage.py test accounts config sync media_assets training
```

Backend tests use PostgreSQL and create/remove a separate test database. The local container role supports this; an externally managed role needs test-database privileges.

```bash
cd frontend
npm run typecheck
npm run build
npm run test:e2e
```

Browser tests start production preview and Django. Alternate ports: `TRAINFUEL_API_PORT=18000 TRAINFUEL_WEB_PORT=15173 npm run test:e2e`; match the `.env` CSRF origin. Run periodic media cleanup and feed retention commands described in the API docs. Local media storage is ignored by Git; S3-compatible storage requires a private bucket and environment-specific configuration.

Deployment configuration, Google/SMTP/S3 live checks, full domain schema, and domain-specific offline adapters remain required before website release. Product rules and defaults are in [the PRD](docs/prd.md); contributor guidance is in [AGENTS.md](AGENTS.md).

Progress tracking, private galleries/comparisons and reminders are documented in [docs/progress-api.md](docs/progress-api.md). Milestone 5 replay examples are in [its Postman collection](docs/postman/TrainFuel.milestone-5.postman_collection.json).
