# TrafficFlow Backend

REST API for TrafficFlow, built with Node.js, Express 5, TypeScript and PostgreSQL (`pg`, plain SQL).

**Current milestone: the login stage.** The API provides:

- **Registration:**
  - Anyone can create an account. It is always a `CITIZEN` account, whatever the request asks for.
  - Input is validated with Zod.
  - Passwords are hashed with bcrypt and never stored in plain text.
- **Login and logout:** a JWT session in an `httpOnly` cookie.
- **The current user:** `GET /api/v1/auth/me`.
- **A protected test route:** `GET /api/v1/protected-test`, which only answers logged-in users.
- **Health checks:** liveness, and readiness (PostgreSQL reachable and the users table migrated).

## Requirements

- Node.js 24 LTS (22 or later works)
- PostgreSQL 15 or later. The easiest way is Docker Desktop with the project's `docker-compose.yml`; installing PostgreSQL on Windows also works.

## Getting started

All commands are for PowerShell.

### 1. Start PostgreSQL

**Option A: Docker Desktop (recommended).** In the repository root (the folder with `docker-compose.yml`):

```powershell
Copy-Item .env.example .env      # then open .env and set POSTGRES_PASSWORD
docker compose up -d db          # downloads PostgreSQL 17 the first time
docker compose ps                # wait until "db" shows (healthy)
```

This creates two databases owned by the user `trafficflow`:

- `trafficflow`: the application's database.
- `trafficflow_test`: an empty one for the integration tests.

The data survives restarts. `docker compose down -v` deletes it.

> The password is fixed when the database is first created. If you change `POSTGRES_PASSWORD` later, run `docker compose down -v` (this deletes the data) and start again.

**Option B: PostgreSQL installed on Windows** (from <https://www.postgresql.org/download/windows/>). Open *SQL Shell (psql)*, log in as `postgres`, and run:

```sql
CREATE USER trafficflow WITH PASSWORD 'choose-a-password';
CREATE DATABASE trafficflow OWNER trafficflow;
CREATE DATABASE trafficflow_test OWNER trafficflow;  -- optional, for the integration tests
```

### 2. Install and configure the backend

```powershell
cd backend
npm install
Copy-Item .env.example .env
```

Edit `backend/.env`:

- **`DATABASE_URL`:** replace `change-this-password` with your database password (`POSTGRES_PASSWORD` when using Docker).
- **`JWT_SECRET`:** a random secret of at least 32 characters. Generate one with:
  ```powershell
  node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
  ```
- **`TEST_DATABASE_URL`:** optional. Set it to run the database tests (see [Tests](#tests)).

### 3. Create the users table

```powershell
npm run db:migrate      # creates the table (safe to run again)
npm run db:status       # optional: lists applied and pending migrations
```

### 4. Start the API

```powershell
npm run dev             # development: restarts on changes, readable logs
# or
npm run build
npm start               # the compiled version from dist/
```

The API runs on <http://localhost:4000>. Check it:

```powershell
curl.exe http://localhost:4000/api/health          # {"status":"ok",...}
curl.exe http://localhost:4000/api/health/ready    # {"status":"ready",...} once PostgreSQL is set up
```

In PowerShell, type `curl.exe`, not `curl`: plain `curl` is an alias for `Invoke-WebRequest`.

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

## API

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/api/health` | anyone | Liveness: the process is running |
| GET | `/api/health/ready` | anyone | Readiness: PostgreSQL answers and the migrations are applied (503 if not) |
| GET | `/api/v1` | anyone | API name and version |
| POST | `/api/v1/auth/register` | anyone | Create a citizen account and log in. Body: `fullName`, `email`, `password`, optional `phone`. Answers `201` with the user. |
| POST | `/api/v1/auth/login` | anyone | Log in. Body: `email`, `password`. Answers `200` with the user, and sets the session cookie. |
| POST | `/api/v1/auth/logout` | anyone | Log out: clears the session cookie (`204`) |
| GET | `/api/v1/auth/me` | logged in | The current user |
| GET | `/api/v1/protected-test` | logged in | Demonstrates a protected route |

Responses never include the password hash.

### Rules

- **Registration:**
  - The name needs 2 to 100 characters.
  - The email must be valid. It is stored in lower case and must be unique, ignoring case.
  - The password needs at least 8 characters, with letters and numbers (at most 72 bytes, bcrypt's limit).
- **Role:** registration always creates a `CITIZEN`. A `role` field in the request is ignored.
- **Sessions:**
  - The JWT is signed with `JWT_SECRET` (HS256) and expires after `JWT_EXPIRES_IN` (default 8 hours).
  - It is stored in the `tf_session` cookie, which is `httpOnly` and `SameSite=Lax`, so JavaScript can't read it.
- **Every protected request re-checks the account in PostgreSQL**, so a deactivated account is logged out immediately.
- **Brute force:** at most 10 failed logins or registrations per IP address per 15 minutes (`AUTH_RATE_LIMIT_MAX`).

### Errors

Every error has the same shape. `details` lists invalid fields for validation errors:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Some of the information provided is invalid",
             "details": [{ "field": "email", "message": "Enter a valid email address" }],
             "requestId": "0b6f4c1e-5d0a-4a57-9a55-2f1f8e0c7d3a" } }
```

| Status | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Invalid input |
| 401 | `AUTH_REQUIRED` | Not logged in |
| 401 | `SESSION_EXPIRED` | The session cookie is invalid or expired, or the account was deactivated |
| 401 | `INVALID_CREDENTIALS` | Wrong email or password |
| 403 | `ACCOUNT_DISABLED` | The account has been deactivated |
| 409 | `EMAIL_TAKEN` | An account with this email already exists |
| 429 | `RATE_LIMITED` | Too many attempts |
| 503 | `SERVICE_UNAVAILABLE` | The database is down (with a `Retry-After` header) |
| 500 | `INTERNAL_ERROR` | A bug: the details are only in the log |

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Starts the API, restarts on file changes, readable logs |
| `npm run build` | Compiles `src/` into `dist/` |
| `npm start` | Runs the compiled API from `dist/` |
| `npm run typecheck` | Type-checks the application and the tests |
| `npm test` | Runs all tests (the database tests only if `TEST_DATABASE_URL` is set) |
| `npm run db:migrate` | Applies database migrations that haven't run yet |
| `npm run db:status` | Lists applied and pending migrations |
| `npm run db:migrate:prod` | The compiled migration script (after `npm run build`) |

## Configuration

Everything comes from environment variables, read from `backend/.env` during development (see `.env.example`). The server checks all settings at startup and refuses to start with a clear message if one is missing or invalid.

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | **required** | PostgreSQL connection string |
| `JWT_SECRET` | **required** | At least 32 random characters; signs the session tokens |
| `PORT` | `4000` | Port the API listens on |
| `NODE_ENV` | `development` | `development`, `test` or `production` |
| `LOG_LEVEL` | `info` | `fatal` … `trace`, or `silent` |
| `JWT_EXPIRES_IN` | `8h` | How long a login lasts |
| `COOKIE_SECURE` | `false` | `true` when the site is served over HTTPS |
| `BCRYPT_ROUNDS` | `12` | Password hashing cost |
| `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`, `AUTH_RATE_LIMIT_MAX` | 15 min, `1000`, `10` | Rate limits |
| `TRUST_PROXY` | `0` | Reverse proxies in front of the API |
| `DATABASE_POOL_MAX` | `10` | Maximum database connections |
| `APP_VERSION` | `dev` | Version shown by `/api/health` |
| `TEST_DATABASE_URL` | – | Tests only: a database whose name contains `test`; wiped by the tests |

## Project structure

```
backend/src/
├── config/env.ts            # Environment variables: schema, defaults, validation
├── db/                      # Connection pool, migration runner, readiness checks, database errors
├── middleware/
│   ├── authenticate.ts      # Protects routes: reads the cookie, verifies the JWT, loads the user
│   ├── validate.ts          # Zod validation of request bodies
│   └── …                    # Logging, rate limits, errors, 404
├── modules/
│   ├── auth/                # Register, login, logout, me; bcrypt (passwords.ts); JWT and cookie (tokens.ts)
│   ├── users/               # SQL for the users table
│   ├── protected/           # GET /api/v1/protected-test
│   └── health/              # Liveness and readiness
├── scripts/migrate.ts       # npm run db:migrate / db:status
├── app.ts                   # Builds the Express app (used by server.ts and the tests)
└── server.ts                # Entry point: config, database pool, HTTP server, graceful shutdown
```

A request travels: route → authenticate (protected routes only) → validate → controller → service → repository (SQL) → PostgreSQL.

## Tests

```powershell
npm test
```

- **Unit tests** need no database. They cover:
  - configuration and the validation rules;
  - refusing protected routes without a session, and forged or expired tokens;
  - the health checks, error handling and the migration runner.
- **Integration tests** (`tests/integration/`) need PostgreSQL:
  - `api.test.ts` covers:
    - registration: success, always `CITIZEN`, bcrypt hash stored, duplicate email, invalid data;
    - login: success, wrong password, unknown user, deactivated account;
    - `/me` and the protected route, with and without a session;
    - logout, then the protected route is rejected.
  - `database.test.ts` covers the migrations and the users table's constraints.
  - They run only when `TEST_DATABASE_URL` is set, and are skipped otherwise. The test database is **wiped** first, and its name must contain `test`. With Docker, add this to `backend/.env`:

    ```
    TEST_DATABASE_URL=postgres://trafficflow:<your-password>@localhost:5432/trafficflow_test
    ```

## Troubleshooting

| Problem | Fix |
|---|---|
| `Invalid environment configuration` at startup | Fix the listed variables in `backend/.env` |
| `Cannot connect to PostgreSQL at …` | PostgreSQL isn't running: `docker compose up -d db` in the repository root |
| `PostgreSQL rejected the user or password` | The password in `DATABASE_URL` must match `POSTGRES_PASSWORD` in the root `.env` |
| `/api/health/ready` returns 503 with `migrations: down` | Run `npm run db:migrate` |
| `docker compose up` fails with `port is already allocated` | Another PostgreSQL uses port 5432. Set `POSTGRES_PORT=5433` in the root `.env`, and use port 5433 in `DATABASE_URL`. |
| Login returns 429 | Too many failed attempts: wait 15 minutes, or restart the API |
