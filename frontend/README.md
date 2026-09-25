# TrafficFlow Frontend

Web app for TrafficFlow, built with React 19, TypeScript, Vite, Tailwind CSS, React Router, Axios and Leaflet with OpenStreetMap.

Each role gets its own section:

| Role | Pages |
|---|---|
| **Citizen** | My reports (with live status) · Report an incident (map picker, "use my location", severity estimate, photo) · Incident detail with timeline and notes |
| **Operator** | Dashboard (live statistics and charts) · Incident queue (filters, search, paging) · Review page (verify or reject, assign responders, cancel, add notes, resolve) · Live map |
| **Responder** | My assignments (go on or off duty, start responding) · Incident detail with directions, notes and "mark resolved" |
| **Admin** | System overview · Users (create any role, edit, deactivate) · Responders · Incident types · Incidents and live map (read-only) |

## Requirements

- Node.js 24 LTS (22 or later works)
- The backend running on <http://localhost:4000> (see [`backend/README.md`](../backend/README.md))

## Getting started

```powershell
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173> and log in.
- **Demo data:** if you seeded it, use the demo accounts listed in [`database/README.md`](../database/README.md).
- **No demo data:** register a citizen account, or log in with your admin account.

An `.env` file is optional. Copy `.env.example` to `.env` only to change the defaults (map position, or where `/api` requests go).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server with instant reload on http://localhost:5173 |
| `npm run build` | Type check, then a production build in `dist/` |
| `npm run preview` | Serves the production build locally |
| `npm run typecheck` | Type check only |
| `npm test` | Unit tests (Vitest) |

## How it fits together

- **One origin.** The app calls `/api/v1/...` on its own address. In development Vite forwards these requests to the backend (see `vite.config.ts`); in production Nginx will do the same. There is no CORS setup, and the login cookie just works.
- **Login.** The session is an `httpOnly` cookie that page scripts can't read. On startup the app asks `GET /auth/me` who is logged in (`features/auth/AuthContext.tsx`). When any request returns 401, the user is sent back to the login page.
- **Role-based routes.** `routes/guards.tsx` keeps each role inside its own section. This is for usability only: the backend checks every request.
- **Live updates.** Lists, dashboards and detail pages refresh every 20 seconds while the tab is visible (`hooks/useAsync.ts`). That's simpler than WebSockets and fast enough for this use.
- **Maps.** Leaflet with OpenStreetMap tiles; incident markers are coloured by status. The default centre is Colombo, and can be changed in `.env`.
- **Charts.** Plain HTML and Tailwind, no chart library:
  - one blue for quantities
  - the standard good/warning/serious/critical colours for severity, always with a text label
  - two colour-blind-safe colours for the reported vs. resolved chart
  - a value label on every bar

## Project structure

```
frontend/src/
├── api/              # Axios client and one function per API endpoint
├── components/ui/    # Buttons, form fields, badges, cards, modal, pagination, icons
├── features/
│   ├── auth/         # Login, registration, AuthContext
│   ├── incidents/    # Shared: maps, incident details, timeline, assignments, cards
│   ├── citizen/      # My reports, report form, incident page
│   ├── operator/     # Dashboard, queue, review page and actions, live map, charts
│   ├── responder/    # Assignments, incident page with response actions
│   └── admin/        # System overview, users, responders, incident types
├── hooks/            # useAsync: loading, errors and polling
├── layouts/          # App shell with role-based navigation; login layout
├── routes/           # Route guards (logged in, role, guest only)
├── types/            # Types for the API's data
├── utils/            # Labels, colours, date and number formatting
├── App.tsx           # All routes
└── main.tsx          # Entry point
```

## Configuration

`VITE_*` variables are built into the JavaScript that every visitor downloads, so they must never contain secrets.

| Variable | Default | Description |
|---|---|---|
| `VITE_MAP_DEFAULT_LAT` | `6.9271` | Map centre latitude (Colombo) |
| `VITE_MAP_DEFAULT_LNG` | `79.8612` | Map centre longitude |
| `VITE_MAP_DEFAULT_ZOOM` | `12` | Map zoom level |
| `API_PROXY_TARGET` | `http://localhost:4000` | Development only: where `/api` requests are forwarded |
