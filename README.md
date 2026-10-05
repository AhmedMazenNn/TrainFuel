# TrainFuel

A website-first workout, manual nutrition, and private progress tracker. This repository currently provides the application foundation; product journeys, offline sync, and private-media APIs are future development work. React Native apps are a later phase.

See the [feature roadmap](docs/feature-roadmap.md) for the planned milestones, branch names, dependencies, and acceptance criteria.

## Repository layout

```text
.agents/skills/       Project-specific development guidance
backend/             Django + DRF, UUID account foundation, PostgreSQL settings
frontend/            Minimal React + TypeScript + Vite application
docs/prd.md          Product requirements and acceptance criteria
docs/schema.dbml     Logical database model; not a deployable migration
docs/diagrams/       Database diagram
compose.yaml         Local PostgreSQL service and persistent volume
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
   docker compose up -d db
   docker compose ps
   ```

   On Linux with Podman and the Docker Compose compatibility provider, start the user socket and point Compose at it:

   ```bash
   systemctl --user start podman.socket
   export DOCKER_HOST="unix://${XDG_RUNTIME_DIR}/podman/podman.sock"
   docker compose up -d db
   ```

   Wait for the database to become healthy. The named volume retains data when the service stops. After initialization, changing credentials in `.env` does not change an existing database role automatically.

3. Install backend dependencies and migrate:

   ```bash
   python3 -m venv backend/.venv
   backend/.venv/bin/python -m pip install -r backend/requirements.txt
   backend/.venv/bin/python backend/manage.py migrate
   backend/.venv/bin/python backend/manage.py runserver 127.0.0.1:8000
   ```

   `http://127.0.0.1:8000/api/health/` returns `{"status":"ok"}` when the database is reachable, or HTTP 503 when unavailable. The migrations establish Django infrastructure and the UUID email-based user foundation; they do not implement all 27 DBML tables. Optionally create a local admin with `backend/.venv/bin/python backend/manage.py createsuperuser`.

4. In another terminal, start the minimal frontend:

   ```bash
   cd frontend
   npm ci
   npm run dev
   ```

   Open the URL printed by Vite. `/api` requests are proxied to the local backend during development.

## Checks

```bash
backend/.venv/bin/python backend/manage.py check
backend/.venv/bin/python backend/manage.py makemigrations --check --dry-run
backend/.venv/bin/python backend/manage.py test accounts config
```

Backend tests use PostgreSQL and create/remove a separate test database. The local container role supports this; an externally managed role needs test-database privileges.

```bash
cd frontend
npm run typecheck
npm run build
```

This setup is for local development. Deployment configuration, production secrets/permissions, full domain schema, authentication APIs, synchronization, and private uploads remain separate feature work. Product rules and proposed defaults are documented in [the PRD](docs/prd.md); coding guidance lives in [AGENTS.md](AGENTS.md).
