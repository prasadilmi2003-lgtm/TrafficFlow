# TrafficFlow Backend

REST API for TrafficFlow, built with Node.js, Express 5, TypeScript and PostgreSQL.

It provides:

- **Accounts and login:** citizens register themselves; operators, responders and admins are created by an admin. Sessions use a JWT in an `httpOnly` cookie.
- **Incidents:** reporting with an optional photo and severity estimate, then the full lifecycle, with every status change and note recorded:
  `REPORTED → VERIFIED → ASSIGNED → RESPONDING → RESOLVED`, or `REJECTED` after review.
- **Multiple responders per incident:** each responder has their own assignment status, and availability is tracked automatically.
- **Administration:** users, responder profiles and incident types.
- **Statistics:** an operator dashboard and a system overview for admins.
- **Operations:** health and readiness checks, structured logs with request IDs, and consistent error responses.

## Requirements

- Node.js 24 LTS (22 or later works)
- PostgreSQL 15 or later. The easiest way is Docker Desktop with the project's `docker-compose.yml`; installing PostgreSQL on Windows also works. Both are covered below.

## Getting started

All commands are for PowerShell. Steps 1 and 3–5 run in the `backend` folder; step 2 runs in the repository root.

### 1. Install dependencies

```powershell
npm install
```

### 2. Start PostgreSQL

**Option A: Docker Compose (recommended).** In the repository root (the folder with `docker-compose.yml`):

```powershell
Copy-Item .env.example .env      # then open .env and choose a POSTGRES_PASSWORD
docker compose up -d db          # downloads PostgreSQL 17 the first time
docker compose ps                # wait until "db" shows (healthy)
```

This creates two databases owned by the `trafficflow` user:

- `trafficflow`: the application's database.
- `trafficflow_test`: an empty one for the integration tests.

The data is kept in a Docker volume, so it survives `docker compose stop` and restarts of your computer.

> The password is fixed when the volume is first created. If you change `POSTGRES_PASSWORD` later, the old one still applies, until you delete the volume (and all its data) with `docker compose down -v`.

**Option B: PostgreSQL installed on Windows.** Open *SQL Shell (psql)* as the `postgres` user and run:

```sql
CREATE USER trafficflow WITH PASSWORD '<db-password>';
CREATE DATABASE trafficflow OWNER trafficflow;
CREATE DATABASE trafficflow_test OWNER trafficflow;  -- optional, for the integration tests
```

### 3. Configure

```powershell
Copy-Item .env.example .env
```

Then edit `backend/.env`:

- **`DATABASE_URL`:** replace `change-this-password` with the password you chose in step 2 (`POSTGRES_PASSWORD` for Docker). The user, port and database name must match too.
- **`JWT_SECRET`:** paste a random secret. Generate one with:
  ```powershell
  node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
  ```
- **`ADMIN_PASSWORD`:** the password for the first admin account (`ADMIN_EMAIL`, default `admin@trafficflow.local`).
- **`DEMO_USER_PASSWORD`:** a password for the demo accounts (optional).
- **`TEST_DATABASE_URL`:** optional. Set it to run the database tests (see [Testing](#testing)).

### 4. Create the tables and the first accounts

```powershell
npm run db:migrate            # creates the tables (safe to run again)
npm run db:status             # optional: lists applied and pending migrations
npm run db:seed               # creates the admin account from .env
npm run db:seed -- --demo     # optional: demo operators, responders, citizens and incidents
```

The demo accounts are listed in [`database/README.md`](../database/README.md). They all use `DEMO_USER_PASSWORD`. Both commands are safe to run again: nothing is applied or created twice.

### 5. Start the API

```powershell
npm run dev
```

The API runs on <http://localhost:4000>. Check it with:

```powershell
curl.exe http://localhost:4000/api/health          # liveness: {"status":"ok",...}
curl.exe http://localhost:4000/api/health/ready    # readiness
```

When everything is set up, readiness answers `200`:

```json
{"status":"ready","checks":{"database":{"status":"up","responseTimeMs":2},"migrations":{"status":"up","responseTimeMs":9}}}
```

It answers `503` with `"status":"not_ready"` if PostgreSQL isn't reachable (`database: down`) or the migrations haven't been run (`migrations: down`). The startup log also says what's wrong and how to fix it.

In PowerShell, type `curl.exe`, not `curl`: plain `curl` is an alias for `Invoke-WebRequest`. Then start the frontend (see [`frontend/README.md`](../frontend/README.md)) to use the app in a browser.

## Try the login flow by hand

Run this in PowerShell with the API started. `-c` saves the session cookie to `cookies.txt` and `-b` sends it back, like a browser would.

```powershell
# 1. Register (the "role" is ignored: the account is always a CITIZEN)
curl.exe -i -X POST http://localhost:4000/api/v1/auth/register -H "Content-Type: application/json" `
  -d '{\"fullName\":\"Nimal Perera\",\"email\":\"nimal@example.com\",\"password\":\"Secret123\",\"role\":\"ADMIN\"}'

# 2. Log in (saves the session cookie)
curl.exe -c cookies.txt -X POST http://localhost:4000/api/v1/auth/login -H "Content-Type: application/json" `
  -d '{\"email\":\"nimal@example.com\",\"password\":\"Secret123\"}'

# 3. Who am I?                       -> 200 with the user
curl.exe -b cookies.txt http://localhost:4000/api/v1/auth/me

# 4. The protected route             -> 200 "Hello Nimal Perera, you are authenticated."
curl.exe -b cookies.txt http://localhost:4000/api/v1/protected-test

# 5. Log out (clears the cookie)     -> 204
curl.exe -b cookies.txt -c cookies.txt -X POST http://localhost:4000/api/v1/auth/logout

# 6. The protected route again       -> 401 AUTH_REQUIRED
curl.exe -b cookies.txt http://localhost:4000/api/v1/protected-test
```

More checks:

- **Duplicate registration:** register the same email again, in any upper/lower case. You get `409 EMAIL_TAKEN`.
- **Wrong password:** you get `401 INVALID_CREDENTIALS`.
- **Unknown email:** you get the same `401 INVALID_CREDENTIALS`, so nobody can find out which emails are registered.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Starts the API, restarts on file changes, readable logs |
| `npm run build` | Compiles `src/` into `dist/` |
| `npm start` | Runs the compiled API from `dist/` (what Docker will run) |
| `npm run typecheck` | Type-checks the application and the tests |
| `npm test` | Runs all tests (the database tests only if `TEST_DATABASE_URL` is set) |
| `npm run test:watch` | Re-runs tests on file changes |
| `npm run db:migrate` | Applies database migrations that haven't run yet |
| `npm run db:status` | Lists applied and pending migrations, and flags any edited after being applied |
| `npm run db:seed` | Creates the admin account (`-- --demo` adds demo data) |
| `npm run db:migrate:prod`, `npm run db:seed:prod` | The same scripts compiled in `dist/` (run `npm run build` first). Docker uses these, since `tsx` is a development tool. |

## Configuration

Everything comes from environment variables, read from `backend/.env` during development. Variables already set in the environment (for example by Docker Compose) take precedence over the file.

The server checks all settings at startup. If one is wrong, it refuses to start and lists the problems, for example `JWT_SECRET: must be at least 32 characters long`.

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | **required** | PostgreSQL connection string |
| `JWT_SECRET` | **required** | At least 32 random characters; signs login tokens |
| `NODE_ENV` | `development` | `development`, `test` or `production` |
| `PORT` | `4000` | Port the API listens on |
| `LOG_LEVEL` | `info` | `fatal` … `trace`, or `silent` |
| `TRUST_PROXY` | `0` | Reverse proxies in front of the API (`1` behind Nginx) |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate-limit window (15 minutes) |
| `RATE_LIMIT_MAX` | `1000` | Requests per client IP per window on `/api/v1` |
| `AUTH_RATE_LIMIT_MAX` | `10` | Failed logins/registrations per client IP per window |
| `JWT_EXPIRES_IN` | `8h` | How long a login lasts |
| `COOKIE_SECURE` | `false` | `true` when served over HTTPS |
| `BCRYPT_ROUNDS` | `12` | Password hashing cost |
| `UPLOAD_DIR` | `uploads` | Folder for incident photos (ignored by Git) |
| `MAX_UPLOAD_SIZE_MB` | `5` | Largest photo accepted |
| `DATABASE_POOL_MAX` | `10` | Maximum database connections |
| `APP_VERSION` | `dev` | Version shown by `/api/health` |
| `ADMIN_PASSWORD` | – | Seed script: password of the first admin (required by `db:seed`) |
| `ADMIN_EMAIL`, `ADMIN_NAME` | `admin@trafficflow.local`, `System Administrator` | Seed script: the first admin |
| `DEMO_USER_PASSWORD` | – | Seed script: password for the demo accounts |
| `TEST_DATABASE_URL` | – | Tests: a disposable database whose name contains `test` |

## API

All endpoints below start with `/api/v1` unless stated otherwise. The session cookie is set by `/auth/login` and `/auth/register`.

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/api/health` | anyone | Liveness: the process is running |
| GET | `/api/health/ready` | anyone | Readiness: PostgreSQL answers and every migration is applied (503 if not) |
| POST | `/auth/register` | anyone | Create a citizen account and log in |
| POST | `/auth/login` | anyone | Log in |
| POST | `/auth/logout` | anyone | Log out |
| GET | `/auth/me` | logged in | The current user |
| GET | `/protected-test` | logged in | A simple protected route that demonstrates authentication |
| GET | `/incident-types` | logged in | Active incident types |
| POST | `/incidents` | citizen | Report an incident (multipart: `incidentTypeId`, `description`, `latitude`, `longitude`, optional `locationText`, `severity` and `image`) |
| GET | `/incidents/mine` | citizen | Own reports (`?status=`, `?page=`) |
| GET | `/incidents` | operator, admin | All incidents (`?status=A,B`, `typeId`, `severity`, `search`, `from`, `to`, `page`, `limit`) |
| GET | `/incidents/map` | operator, admin | Open incidents for the map |
| GET | `/incidents/:id` | reporter, operator, admin, assigned responder | Incident with its assignments and status history |
| GET | `/incidents/:id/image` | same as above | The incident's photo |
| PATCH | `/incidents/:id/verify` | operator | `REPORTED → VERIFIED` (`severity`, optional `note`) |
| PATCH | `/incidents/:id/reject` | operator | `REPORTED → REJECTED` (`reason`) |
| POST | `/incidents/:id/assignments` | operator | Assign responders (`responderIds`, optional `notes`) |
| PATCH | `/incidents/:id/assignments/:assignmentId/cancel` | operator | Cancel an assignment that hasn't started |
| PATCH | `/incidents/:id/resolve` | responding responder, operator | `RESPONDING → RESOLVED` (`resolutionNotes`) |
| POST | `/incidents/:id/notes` | assigned responder, operator | Add a note to an open incident (`note`); the status doesn't change |
| GET | `/responders` | operator, admin | Responders (`?type=`, `?availability=`, `?includeInactive=`) |
| GET | `/responder/me` | responder | Own profile and availability |
| PATCH | `/responder/me/availability` | responder | Go on duty (`AVAILABLE`) or off duty (`OFF_DUTY`) |
| GET | `/responder/assignments` | responder | Own assignments (`?scope=active` or `history`) |
| PATCH | `/responder/assignments/:id/respond` | responder | Start responding |
| GET | `/stats/dashboard` | operator, admin | Operational statistics |
| GET | `/stats/system` | admin | System-wide statistics |
| GET, POST | `/admin/users` | admin | List (`?role=`, `?isActive=`, `?search=`, paging) and create users |
| GET, PATCH | `/admin/users/:id` | admin | View and change a user (name, phone, role, active, password) |
| PATCH | `/admin/responders/:id` | admin | Change a responder's type, unit code or availability |
| GET, POST | `/admin/incident-types` | admin | List all types, create a type |
| PATCH | `/admin/incident-types/:id` | admin | Rename, describe, activate or deactivate a type |

### Business rules the API enforces

- **Status order:** status only moves forward along the lifecycle. Anything else returns `409 INVALID_STATUS_TRANSITION`; the right change by the wrong role returns `403 TRANSITION_NOT_ALLOWED`. The rules are in `src/modules/incidents/lifecycle.ts`.
- **Assigning responders:**
  - Only verified incidents can be assigned.
  - Responders who are off duty, deactivated or already assigned are refused.
  - Assigned responders become `BUSY`, and `AVAILABLE` again when their work ends.
- **Cancelling:** only assignments that haven't started responding can be cancelled, and never the last one. The replacement must be assigned first.
- **Resolving:** only a responder who is responding, or an operator as an override, can resolve an incident. All open assignments are then completed.
- **Severity:** a citizen may give their own estimate when reporting. The operator confirms or changes it when verifying, and verification always requires one.
- **Notes:** responders on an active assignment and operators can add notes to open incidents, e.g. "arrived on scene". Notes appear in the timeline, which the reporting citizen also sees. Resolved and rejected incidents take no more notes (`409 INCIDENT_CLOSED`).
- **Who sees what:** citizens only see their own incidents, and responders only the ones they are assigned to. Others get `404`, so they can't tell an incident exists.
- **Registration:** it always creates a citizen, whatever the request contains.
- **Admin self-protection:** admins can't deactivate themselves or remove their own admin role.
- **Deactivation:** a deactivated account is logged out on its next request.

### Errors

Every error response has the same shape. `details` appears for validation errors, with one entry per invalid field:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Some of the information provided is invalid",
             "details": [{ "field": "email", "message": "Enter a valid email address" }],
             "requestId": "0b6f4c1e-5d0a-4a57-9a55-2f1f8e0c7d3a" } }
```

Common codes:

| Code | When |
|---|---|
| `VALIDATION_ERROR` | Invalid input |
| `AUTH_REQUIRED`, `SESSION_EXPIRED` | Not logged in, or the login has expired |
| `INVALID_CREDENTIALS` | Wrong email or password |
| `FORBIDDEN` | The user's role can't do this |
| `NOT_FOUND` | The resource doesn't exist, or the user may not see it |
| `INVALID_STATUS_TRANSITION` | The status change isn't part of the lifecycle |
| `INVALID_FILE_TYPE`, `FILE_TOO_LARGE` | Photo upload problems |
| `RATE_LIMITED` | Too many requests |
| `SERVICE_UNAVAILABLE` | `503`: the database is down or unreachable. A `Retry-After` header says when to try again. |
| `INTERNAL_ERROR` | A bug: details are only in the log |

## Project structure

```
backend/
├── src/
│   ├── config/env.ts            # Environment variables: schema, defaults, validation
│   ├── db/                      # Connection pool, transactions, migration runner, readiness checks, database errors
│   ├── middleware/              # Logging, auth, roles, validation, uploads, rate limits, errors
│   ├── modules/
│   │   ├── auth/                # Register, login, sessions (JWT cookie), password hashing
│   │   ├── users/               # Admin user management
│   │   ├── responders/          # Responder profiles, availability, own assignments
│   │   ├── incidentTypes/       # Incident types
│   │   ├── incidents/           # Incidents, assignments, history, lifecycle.ts
│   │   ├── stats/               # Dashboard and system statistics
│   │   ├── protected/           # GET /api/v1/protected-test
│   │   └── health/              # Liveness and readiness
│   ├── scripts/                 # migrate.ts and seed.ts (npm run db:migrate / db:seed)
│   ├── types/                   # Shared domain types
│   ├── utils/                   # Errors, logger, pagination, image checks
│   ├── app.ts                   # Builds the Express app (used by server.ts and the tests)
│   └── server.ts                # Entry point: config, database, HTTP server, graceful shutdown
└── tests/                       # Unit tests, plus integration tests in tests/integration/
```

Each module is split into layers:

| File | Job |
|---|---|
| `*.routes.ts` | Maps URLs to handlers and applies role checks and validation |
| `*.controller.ts` | HTTP only: read the request, call the service, send the response |
| `*.service.ts` | Business rules and transactions |
| `*.repository.ts` | Parameterised SQL. Nothing else touches the database. |
| `*.schemas.ts` | Zod input validation |

A request travels: route → authenticate → authorize → validate → controller → service → repository → PostgreSQL.

## Testing

```powershell
npm test
```

- **Unit tests** need no database. They cover:
  - configuration, the lifecycle rules, validation and access control without a session;
  - the health checks and error handling, including `503` when the database is down;
  - the migration files and checksums, how database errors are classified, and the utilities.
- **Integration tests** (`tests/integration/`) run against a real PostgreSQL database:
  - `database.test.ts`: the database foundation.
    - Migrations on an empty database, including two processes migrating at once.
    - Detection of an edited migration, and Windows line endings.
    - Readiness before and after migrating.
    - The constraints, foreign keys, unique indexes and triggers that protect the data.
  - `auth.test.ts`: registration and login.
    - Registration always creates a `CITIZEN`, stores a bcrypt hash, and handles duplicate emails and invalid data.
    - Login: success, wrong password, unknown user, deactivated account.
    - `/me` and the protected route, and logout.
  - `incidents.test.ts`: the complete incident lifecycle and the business rules above, statistics and administration.
    - Reporting with a photo and severity, verification, assigning two responders, responding, notes, cancelling and resolving.
  - `rbac.test.ts`: role-based access control.
    - Every role is sent to 23 routes across the citizen, operator, responder and admin areas.
    - It must be refused (`403`) exactly where its role isn't allowed, and anonymous requests always get `401`.
  - They run only when `TEST_DATABASE_URL` is set, in `.env` or in the shell. Otherwise they are skipped.
  - The test database is **wiped** first, and its name must contain `test`.

To run the integration tests with the Docker Compose database, which already has an empty `trafficflow_test` database, add this to `backend/.env` (same password as `DATABASE_URL`) and run `npm test`:

```
TEST_DATABASE_URL=postgres://trafficflow:<password>@localhost:5432/trafficflow_test
```

## Troubleshooting

| Problem | Fix |
|---|---|
| `Invalid environment configuration` at startup | Read the listed variables and fix them in `.env` |
| `Cannot connect to PostgreSQL at …` | PostgreSQL isn't running, or `DATABASE_URL` has the wrong host or port. With Docker: `docker compose up -d db` in the repository root, then `docker compose ps` |
| `PostgreSQL rejected the user or password` | The password in `DATABASE_URL` must match `POSTGRES_PASSWORD` in the root `.env`. Changed it after the first start? See the note in step 2. |
| `The database … does not exist` | Create it (step 2), or fix the database name in `DATABASE_URL` |
| `migration(s) have not been applied` in the log, or `migrations: down` in readiness | Run `npm run db:migrate` |
| `… changed after it was applied to this database` | A migration that already ran was edited. Undo the edit (`git restore database/migrations`) and put the change in a new migration file. |
| `/api/health/ready` returns 503 | Its `checks` show which part is down: `database` or `migrations` (see the rows above) |
| API requests return 503 `SERVICE_UNAVAILABLE` | The database went down. The API reconnects by itself once PostgreSQL is back. |
| `docker compose up` fails with `port is already allocated` | Another PostgreSQL uses port 5432. Set `POSTGRES_PORT=5433` in the root `.env`, and use port 5433 in `DATABASE_URL`. |
| Login returns 429 | Too many failed attempts from your IP: wait 15 minutes, or restart the API in development |
