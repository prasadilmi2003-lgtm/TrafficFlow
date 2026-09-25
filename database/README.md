# TrafficFlow Database

PostgreSQL schema for TrafficFlow, written as plain SQL.

```
database/
├── migrations/     # Numbered SQL files, applied in order by `npm run db:migrate`
├── seeds/
│   └── demo-data.json   # Demo accounts and incidents for `npm run db:seed -- --demo`
└── docker-init/    # Runs once when the Docker Compose PostgreSQL is first created
    └── 01-create-test-database.sql   # The empty trafficflow_test database for the tests
```

The scripts that apply these files live in the backend (`backend/src/scripts/`). Run them from the `backend` folder.

## Starting PostgreSQL

For development, PostgreSQL runs in Docker, defined in `docker-compose.yml` at the repository root:

```powershell
# In the repository root
Copy-Item .env.example .env      # first time only: then set POSTGRES_PASSWORD in .env
docker compose up -d db
docker compose ps                # "db" should show (healthy)
```

Then, in `backend/`, put the same password in `DATABASE_URL` in `backend/.env` and run `npm run db:migrate`. The full walkthrough, including installing PostgreSQL on Windows instead of using Docker, is in [backend/README.md](../backend/README.md#getting-started).

## Tables and relationships

```
users 1 ──── 0..1 responder_profiles      a responder's type, unit code and availability
users 1 ──── *    incidents               reported_by (and reviewed_by: the operator)
incident_types 1 ─ * incidents
incidents 1 ──── * incident_assignments * ──── 1 users (the responder; assigned_by: the operator)
incidents 1 ──── * incident_status_history * ── 1 users (changed_by)
```

- **Several responders per incident:** `incident_assignments` links incidents and responders (many-to-many). Each row has its own status: `ASSIGNED → RESPONDING → COMPLETED`, or `CANCELLED`.
- **Primary keys** are UUIDs (`gen_random_uuid()`). Incidents also get a readable `reference_no` such as `TF-000123`.
- **Timestamps:** every table records when a row was created (`created_at`, or `assigned_at` for assignments). Tables whose rows change also have an `updated_at`, which a trigger keeps current. Timestamps are `TIMESTAMPTZ` (stored in UTC).
- **Fixed lists** are PostgreSQL enum types:
  - roles `CITIZEN, OPERATOR, RESPONDER, ADMIN`
  - incident status `REPORTED, VERIFIED, ASSIGNED, RESPONDING, RESOLVED, REJECTED`
  - severity `LOW, MEDIUM, HIGH, CRITICAL`
  - assignment status, responder type and availability

  Incident types are a table, because admins can add types.

## Migrations

| File | Creates |
|---|---|
| `001_create_types_and_functions.sql` | The `user_role` enum and the `set_updated_at()` trigger function |
| `002_create_users.sql` | `users`, with a case-insensitive unique email |
| `003_create_responder_profiles.sql` | The `responder_type` and `responder_availability` enums; `responder_profiles`: responder type, unit code, availability |
| `004_create_incident_types.sql` | `incident_types`, plus the 7 default types |
| `005_create_incidents.sql` | The `incident_status` and `incident_severity` enums; `incidents`, and readable references `TF-000123` from a sequence |
| `006_create_incident_assignments.sql` | The `assignment_status` enum; `incident_assignments`: several responders per incident |
| `007_create_incident_status_history.sql` | `incident_status_history`: the timeline and audit trail, status changes and notes |

Files 001 and 002 are the login stage. 003 to 007 add the incident features on top, so a database that already has the users table only needs the new files: run `npm run db:migrate`.

**How it works** (the runner is `backend/src/db/migrate.ts`):

- `npm run db:migrate` applies every file that hasn't run yet, in name order.
- Each file runs in its own transaction, so a failing file changes nothing. It is then recorded in the `schema_migrations` table with a SHA-256 checksum of its content. Running the command again does nothing.
- A PostgreSQL advisory lock stops two processes (for example two containers starting together) from migrating at the same time.
- `npm run db:status` lists which files are applied and which are pending, without changing anything.
- The API's readiness check (`GET /api/health/ready`) only reports `ready` when every migration has been applied. An API running against an old schema would fail on its first real request.

**Rules:**

- Never edit a migration that has been applied. Change the schema by adding a new file, e.g. `008_add_something.sql`.
  - The checksums enforce this. If an applied file changes, `db:migrate` refuses to run, `db:status` flags the file, and readiness reports `not_ready`.
  - Line endings don't count, so Windows and Linux checkouts of the same file match.
- File names are three digits, an underscore, and lowercase words.

**The database protects itself:**

- **Constraints:** coordinate ranges, description length, and required fields per status. For example, `REJECTED` needs a reason and `RESOLVED` needs a resolution time.
- **Uniqueness:** unique emails and unit codes, ignoring case.
- **No double assignments:** a partial unique index stops a responder being actively assigned to the same incident twice.
- **Foreign keys:** users with history can't be deleted, only deactivated.
- **Severity:** optional while an incident is `REPORTED` (the citizen's estimate) or `REJECTED`, and required from `VERIFIED` onwards.
- **Notes:** a note is a timeline entry whose status doesn't change (`from_status = to_status`).

## Seed data

`npm run db:seed` creates the admin account from `ADMIN_PASSWORD` (required), `ADMIN_EMAIL` (default `admin@trafficflow.local`) and `ADMIN_NAME` in `backend/.env`. Run `npm run db:migrate` first.

`npm run db:seed -- --demo` also loads `seeds/demo-data.json`. Every demo account uses the password in `DEMO_USER_PASSWORD`. No passwords are stored in this repository.

| Email | Role | Unit |
|---|---|---|
| `operator@trafficflow.test` | Operator | |
| `operator2@trafficflow.test` | Operator | |
| `police@trafficflow.test` | Responder | POL-01 (Police) |
| `police2@trafficflow.test` | Responder | POL-02 (Police) |
| `ambulance@trafficflow.test` | Responder | AMB-07 (Ambulance) |
| `fire@trafficflow.test` | Responder | FIRE-03 (Fire service) |
| `tow@trafficflow.test` | Responder | TOW-12 (Tow truck) |
| `roads@trafficflow.test` | Responder | RDA-05 (Road maintenance) |
| `citizen@trafficflow.test` | Citizen | |
| `citizen2@trafficflow.test` | Citizen | |

The 8 demo incidents are spread around Colombo, one or more in each lifecycle stage. They are created through the backend's own incident service, so every status change follows the lifecycle rules and appears in the history. The seed is safe to re-run: existing accounts are left alone, and demo incidents are only added to an empty incidents table.

## Useful commands

From the `backend` folder:

```powershell
npm run db:status        # which migrations have run
npm run db:migrate       # apply the pending ones
```

From the repository root (Docker Compose setup):

```powershell
# Open a SQL prompt. Try \dt (list tables), \d incidents (describe a table), \q (quit)
docker compose exec db psql -U trafficflow trafficflow

# Empty the application database but keep the container: then run db:migrate and db:seed again
docker compose exec db psql -U trafficflow -d trafficflow -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Remove PostgreSQL and ALL its data (both databases); "up -d db" starts again from scratch
docker compose down -v
```
