# TrafficFlow Backend

REST API for TrafficFlow, built with Node.js, Express 5 and TypeScript.

> **Status:** Phase 1 (backend foundation). The service starts, validates its configuration, logs every request, handles errors consistently and exposes health checks. Authentication, incidents and the database arrive in later phases (see the [roadmap](../README.md#roadmap)).

## Requirements

- Node.js 24 LTS (22 or later works)
- npm (included with Node.js)

## Getting started

From the repository root, in PowerShell:

```powershell
cd backend
npm install
Copy-Item .env.example .env
npm run dev
```

On macOS or Linux, use `cp .env.example .env` instead of `Copy-Item`.

The API is now running on <http://localhost:4000>. Check it from another terminal:

```powershell
curl.exe http://localhost:4000/api/health
```

In PowerShell, use `curl.exe` rather than `curl`: plain `curl` is an alias for PowerShell's `Invoke-WebRequest`, which takes different options.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Starts the API with automatic restart on file changes and readable logs |
| `npm run build` | Compiles TypeScript from `src/` into JavaScript in `dist/` |
| `npm start` | Runs the compiled API from `dist/` (what the Docker container will run) |
| `npm run typecheck` | Checks types in the application and tests without building |
| `npm test` | Runs all automated tests once |
| `npm run test:watch` | Re-runs the tests whenever a file changes |

## Configuration

All settings come from environment variables. For local development they are read from `backend/.env` (copied from `.env.example`). Variables that are already set, for example by Docker Compose, take precedence over the file.

The configuration is validated when the server starts. If a value is invalid, the server refuses to start and lists every problem:

```
Invalid environment configuration:
  - PORT: Too big: expected number to be <=65535
  - NODE_ENV: Invalid option: expected one of "development"|"test"|"production"
```

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | `development`, `test` or `production` |
| `PORT` | `4000` | Port the API listens on |
| `LOG_LEVEL` | `info` | `fatal`, `error`, `warn`, `info`, `debug`, `trace` or `silent` |
| `TRUST_PROXY` | `0` | Number of reverse proxies in front of the API: `0` locally, `1` behind Nginx |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate-limit window in milliseconds (15 minutes) |
| `RATE_LIMIT_MAX` | `300` | Requests allowed per client IP per window on `/api/v1` |
| `APP_VERSION` | `dev` | Version shown by `/api/health`; the deployment pipeline sets it to the Git commit |

Phase 1 has no secrets. `DATABASE_URL` and `JWT_SECRET` are added in Phases 3 and 4. Never commit `.env`.

## Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | **Liveness:** the process is running. Never checks external services. |
| GET | `/api/health/ready` | **Readiness:** every dependency the API needs is available |
| GET | `/api/v1` | API information. Feature endpoints are added under `/api/v1` in later phases. |

The health endpoints are not versioned because infrastructure (Docker, Nginx, the deployment pipeline) depends on them, and they are not rate limited.

**Liveness:**

```json
{
  "status": "ok",
  "service": "trafficflow-backend",
  "version": "dev",
  "uptimeSeconds": 42,
  "timestamp": "2026-09-23T11:15:00.000Z"
}
```

**Readiness** returns `200` when every check passes and `503 Service Unavailable` otherwise. Each check has a 2-second timeout, and all checks run at the same time.

| Situation | Status | Body |
|---|---|---|
| No dependencies registered (Phase 1) | 200 | `{"status":"ready","checks":{}}` |
| All dependencies working | 200 | `{"status":"ready","checks":{"database":{"status":"up","responseTimeMs":3}}}` |
| A dependency is down or too slow | 503 | `{"status":"not_ready","checks":{"database":{"status":"down","responseTimeMs":2001}}}` |
| The server is shutting down | 503 | `{"status":"shutting_down","checks":{}}` |

Failure details are written to the log, not the response, so internal addresses are never exposed.

### Error responses

Every error has the same shape:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Route GET /api/v1/unknown not found",
    "requestId": "0b6f4c1e-5d0a-4a57-9a55-2f1f8e0c7d3a"
  }
}
```

| Status | Code | When |
|---|---|---|
| 400 | `INVALID_JSON` | The request body is not valid JSON |
| 404 | `NOT_FOUND` | No route matches the request |
| 413 | `PAYLOAD_TOO_LARGE` | The request body is larger than 100 kB |
| 429 | `RATE_LIMITED` | The client exceeded the rate limit |
| 500 | `INTERNAL_ERROR` | An unexpected error. Details are logged, never sent to the client. |

The `requestId` also appears in the `X-Request-Id` response header and in every log line for that request, so a reported problem can be found in the logs.

## Project structure

```
backend/
├── src/
│   ├── config/
│   │   └── env.ts                 # Environment variables: schema, defaults, validation
│   ├── middleware/
│   │   ├── requestLogger.ts       # Request logging and request IDs
│   │   ├── rateLimiter.ts         # Per-IP request limit for /api/v1
│   │   ├── notFound.ts            # 404 for unknown routes
│   │   └── errorHandler.ts        # Turns every error into a JSON response
│   ├── modules/
│   │   └── health/                # Health endpoints (routes → controller → service)
│   ├── metrics/                   # Prometheus metrics (Phase 10)
│   ├── utils/
│   │   ├── AppError.ts            # Expected errors with a status code and error code
│   │   └── logger.ts              # Pino JSON logger
│   ├── app.ts                     # Builds the Express app (used by server.ts and tests)
│   └── server.ts                  # Entry point: config, logger, HTTP server, shutdown
├── tests/                         # Automated tests (Vitest + Supertest)
├── .env.example                   # Documented example configuration
├── tsconfig.json                  # TypeScript settings for editor, type check and tests
└── tsconfig.build.json            # Production build: compiles src/ only
```

### How a request is handled

Middleware runs in this order (see `src/app.ts`):

1. **Request logger:** assigns a request ID and logs the request when it finishes
2. **Helmet:** adds security headers
3. **JSON body parser:** reads JSON bodies up to 100 kB
4. **Health routes:** `/api/health`
5. **Rate limiter + versioned API:** `/api/v1`
6. **Not found:** no route matched, respond 404
7. **Error handler:** converts any error into the standard error response

Feature modules follow the same layers as `modules/health`:

```
route → validation → authentication → authorization → controller → service → repository → PostgreSQL
```

- **Controllers** handle HTTP only.
- **Services** hold the business rules.
- **Repositories** contain the SQL.

### Logging

Logs are JSON, one object per line, with an ISO timestamp, the service name and version, and the request ID. For example (shortened):

```json
{"level":30,"time":"2026-09-23T11:15:02.114Z","service":"trafficflow-backend","version":"dev","req":{"id":"0b6f…","method":"GET","url":"/api/v1"},"res":{"statusCode":200},"responseTime":3,"msg":"request completed"}
```

`npm run dev` pipes them through `pino-pretty` for readability. Successful health checks are not logged, because Docker polls them every few seconds. Authorization headers and cookies are always masked.

### Graceful shutdown

When the process receives `SIGTERM` (sent by `docker stop`) or `SIGINT` (Ctrl+C):

1. Readiness starts answering `503 shutting_down`.
2. The server stops accepting new connections and lets in-flight requests finish.
3. The process exits. If shutdown takes longer than 10 seconds, it is forced.

## Testing

```powershell
npm test
```

Tests use [Vitest](https://vitest.dev/) and [Supertest](https://github.com/ladjs/supertest). They build the real application with `createApp()` and send HTTP requests to it in memory. No port, database or network is needed, so the same tests run unchanged in CI.

| File | Covers |
|---|---|
| `tests/health.test.ts` | Liveness response, readiness when dependencies are up, down, too slow or shutting down |
| `tests/app.test.ts` | `/api/v1`, 404s, invalid and oversized JSON, security headers, request IDs, rate limiting |
| `tests/errorHandler.test.ts` | Expected errors, hidden details of unexpected errors, errors in async handlers |
| `tests/config.test.ts` | Defaults, type conversion, rejection of invalid values |
