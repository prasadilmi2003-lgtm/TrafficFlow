# TrafficFlow

**Smart Traffic Incident & Emergency Response Platform**

TrafficFlow lets citizens report traffic incidents, operators verify them and dispatch responders, and responders update their progress until the incident is resolved.

It is a full-stack web application delivered through a complete DevOps pipeline: containerised with Docker, tested and deployed with GitHub Actions, hosted on AWS EC2 behind Nginx, and monitored with Prometheus and Grafana.

> **Project status:** the current milestone is the **login stage**: PostgreSQL with the users table, registration, login and logout with a JWT session, and a protected route, plus the React pages for registration, login and a protected dashboard. The incident features and the DevOps phases come later. See the [roadmap](#roadmap).

## Roles

| Role | Responsibilities |
|---|---|
| **Citizen** | Register and log in, report incidents (type, description, location, optional photo), view and track their own reports |
| **Operator** | Review reported incidents, verify or reject them, assign responders, update status, view incidents on a map, view dashboard statistics |
| **Responder** | View assigned incidents and their locations, update response status, mark incidents as resolved |
| **Admin** | Manage users and responders, view system statistics, manage system settings such as incident types |

## Incident lifecycle

```
REPORTED ──► VERIFIED ──► ASSIGNED ──► RESPONDING ──► RESOLVED
    │
    └──► REJECTED
```

An incident can have several responders (for example police and an ambulance). Every status change is recorded with who made it and when, which gives citizens a tracking timeline and operators an audit trail. The full rules are in [docs/architecture.md](docs/architecture.md#4-incident-lifecycle).

## Tech stack

| Layer | Technologies |
|---|---|
| Frontend | React, TypeScript, Vite, Tailwind CSS, React Router, Axios, Leaflet + OpenStreetMap |
| Backend | Node.js, Express, TypeScript, REST API, JWT authentication, bcrypt |
| Database | PostgreSQL, plain SQL migrations, `pg` driver |
| DevOps | Git, GitHub, GitHub Actions, Docker, Docker Compose, Nginx, AWS EC2 |
| Monitoring | Prometheus, Grafana |

## Repository structure

```
TrafficFlow/
├── frontend/                 # React web app                        (see frontend/README.md)
├── backend/                  # Express REST API                     (see backend/README.md)
├── database/                 # SQL migrations                       (see database/README.md)
├── docker/                   # Nginx, Prometheus and Grafana config (Phases 9–10)
├── docs/
│   └── architecture.md       # System design and decisions
├── .github/
│   ├── workflows/            # CI/CD pipelines                      (Phases 2 and 11)
│   └── pull_request_template.md
├── docker-compose.yml        # PostgreSQL for development (the full stack from Phase 9)
├── .env.example              # Settings for docker-compose.yml
├── .editorconfig
├── .gitattributes
├── .gitignore
└── README.md
```

Folders marked with a phase are filled in by that phase.

## Architecture

The full design is in **[docs/architecture.md](docs/architecture.md)**: system overview, key decisions, roles and permissions, incident lifecycle, frontend and backend structure, database schema, security, configuration, monitoring and deployment.

## Roadmap

Each phase is built on its own branch and merged into `main` through a pull request. The login stage (phases 1, 3 and 4, plus the login pages of phase 7) was built on `feature/backend-foundation`.

| Phase | Branch | Scope | Status |
|---|---|---|---|
| 0 | `chore/repo-foundation` | Repository conventions and documentation | Done |
| 1 | `feature/backend-foundation` | Express + TypeScript skeleton, configuration, logging, error handling, health check, first tests | Done |
| 2 | `ci/github-actions` | CI pipeline: lint, type check, test and build on every pull request | Planned |
| 3 | `feature/database-schema` | PostgreSQL in Docker Compose for development, SQL migrations, the users table | Done (users table) |
| 4 | `feature/auth-rbac` | Registration, login, password hashing, JWT, protected routes | Done |
| 5 | `feature/incident-reporting` | Citizen incident reporting with image upload, "my incidents", status timeline | Planned |
| 6 | `feature/incident-management` | Verification, responder assignment, response updates, admin management, statistics | Planned |
| 7 | `feature/frontend-foundation` | React app shell, routing, API client, login and registration, role layouts | Login pages done |
| 8 | `feature/frontend-portals` | Citizen, operator (map and dashboard), responder and admin screens | Planned |
| 9 | `feature/containerization` | Dockerfiles, full Docker Compose stack, Nginx reverse proxy | Planned |
| 10 | `feature/monitoring` | Metrics endpoint, Prometheus, Grafana dashboards | Planned |
| 11 | `feature/aws-deployment` | AWS EC2 deployment and continuous deployment pipeline | Planned |
| 12 | `chore/final-docs` | Final documentation, screenshots and demo guide | Planned |

## Development workflow

- `main` always contains reviewed, working code. Nobody pushes to it directly.
- All work happens on a short-lived branch and is merged through a pull request.
- Branch names:
  - `feature/<name>` for new functionality
  - `fix/<name>` for bug fixes
  - `ci/<name>` for pipeline changes
  - `docs/<name>` for documentation only
  - `chore/<name>` for tooling, configuration and housekeeping
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/):

  ```
  feat(auth): add JWT login endpoint
  fix(incidents): reject invalid status transitions
  ci: run backend tests on pull requests
  docs: add architecture overview
  ```

- A pull request is merged when its checklist is complete and, from Phase 2 onward, the automated checks pass.

## Getting started

Prerequisites:

- [Git](https://git-scm.com/)
- [Node.js](https://nodejs.org/) 24 LTS
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (with the WSL 2 backend on Windows)

### Run the application locally

1. **Database:** start PostgreSQL with Docker Compose, from the repository root:

   ```powershell
   Copy-Item .env.example .env      # then set POSTGRES_PASSWORD in .env
   docker compose up -d db
   docker compose ps                # wait until "db" shows (healthy)
   ```

2. **Backend:** follow [backend/README.md](backend/README.md#getting-started):
   `npm install`, fill in `backend/.env`, run `npm run db:migrate`, then `npm run dev`.
   The API runs on <http://localhost:4000>, and <http://localhost:4000/api/health/ready> reports `ready` once the database is set up.
3. **Frontend:** in a second terminal:

   ```powershell
   cd frontend
   npm install
   npm run dev
   ```

   Open <http://localhost:5173>, register an account and you land on the protected dashboard.

For now Docker Compose runs only PostgreSQL. Phase 9 adds the backend, frontend and Nginx, so the whole system starts with one command.

## Configuration and secrets

All secrets (database credentials, the JWT secret, the initial admin password, API keys) are supplied through environment variables and are never committed to Git.

Each part that needs settings has a `.env.example` file listing its variables with placeholder values: the repository root (Docker Compose), `backend/` and `frontend/`. To run locally, copy it to `.env` in the same folder and fill in real values. `.env` files are excluded by `.gitignore`.
