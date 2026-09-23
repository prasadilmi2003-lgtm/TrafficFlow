# TrafficFlow Database

PostgreSQL schema for TrafficFlow, written as plain SQL.

```
database/
├── migrations/     # Numbered SQL files, applied in order by `npm run db:migrate`
└── seeds/
    └── demo-data.json   # Demo accounts and incidents for `npm run db:seed -- --demo`
```

The scripts that apply these files live in the backend (`backend/src/scripts/`). Run them from the `backend` folder.

## Migrations

| File | Creates |
|---|---|
| `001_create_types_and_functions.sql` | Enum types (`user_role`, `incident_status`, …) and the `set_updated_at()` trigger function |
| `002_create_users.sql` | `users`, with a case-insensitive unique email |
| `003_create_responder_profiles.sql` | `responder_profiles`: responder type, unit code, availability |
| `004_create_incident_types.sql` | `incident_types`, plus the 7 default types |
| `005_create_incidents.sql` | `incidents`, and readable references `TF-000123` from a sequence |
| `006_create_incident_assignments.sql` | `incident_assignments`: several responders per incident |
| `007_create_incident_status_history.sql` | `incident_status_history`: the timeline and audit trail |

**How it works:**

- `npm run db:migrate` applies every file that hasn't run yet, in name order.
- Each file runs in its own transaction and is recorded in the `schema_migrations` table. Running it again does nothing.
- A PostgreSQL advisory lock stops two processes from migrating at the same time.

**Rules:**

- Never edit a migration that has been merged. Change the schema by adding a new file, e.g. `008_add_something.sql`.
- File names are three digits, an underscore, and lowercase words.

**The database protects itself:**

- **Constraints:** coordinate ranges, description length, and required fields per status. For example, `REJECTED` needs a reason and `RESOLVED` needs a resolution time.
- **Uniqueness:** unique emails and unit codes, ignoring case.
- **No double assignments:** a partial unique index stops a responder being actively assigned to the same incident twice.
- **Foreign keys:** users with history can't be deleted, only deactivated.

## Seed data

`npm run db:seed` creates the admin account from `ADMIN_EMAIL`, `ADMIN_PASSWORD` and `ADMIN_NAME` in `backend/.env`.

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

```powershell
# Open a SQL prompt (Docker setup)
docker exec -it trafficflow-db psql -U trafficflow trafficflow

# Start again from an empty database (Docker setup): deletes everything
docker exec trafficflow-db psql -U trafficflow -d trafficflow -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
```
