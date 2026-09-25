# TrafficFlow Frontend

Web app for TrafficFlow, built with React 19, TypeScript, Vite, Tailwind CSS, React Router and Axios.

This milestone covers the login stage only:

| Page | What it does |
|---|---|
| `/register` | Create an account. Every new account is a citizen account. |
| `/login` | Log in with email and password. |
| `/dashboard` | Only for logged-in users. It shows your account (from `GET /api/v1/auth/me`) and calls the protected backend route `GET /api/v1/protected-test`. **Log out** is in the top bar. |

Opening `/dashboard` without being logged in redirects to `/login`. Opening `/login` or `/register` while logged in redirects to `/dashboard`.

## Requirements

- Node.js 24 LTS (22 or later works)
- The backend running on <http://localhost:4000> (see [`backend/README.md`](../backend/README.md))

## Getting started

```powershell
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>. Register an account, and you land on the dashboard.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server on port 5173, with hot reload |
| `npm run build` | Type-checks, then builds the production files into `dist/` |
| `npm run preview` | Serves the production build locally |
| `npm run typecheck` | Type-checks without building |
| `npm test` | Runs the unit tests |

## How it talks to the backend

- **One origin:** the browser only talks to the frontend's own address. The Vite development server forwards every `/api` request to the backend (`API_PROXY_TARGET`, default `http://localhost:4000`), so no CORS setup is needed.
- **Session cookie:** after register or login, the backend sets an `httpOnly` cookie holding a JWT.
  - JavaScript can't read it, so a cross-site scripting bug can't steal it.
  - The browser sends it automatically with every API request.
  - Nothing is kept in `localStorage`.
- **Who is logged in:** on startup, `AuthProvider` calls `GET /api/v1/auth/me` (`src/features/auth/AuthContext.tsx`). If any request later gets `401`, the app treats the user as logged out and shows the login page.
- **Errors:**
  - Form errors come from the backend's `400 VALIDATION_ERROR` response and are shown under each field.
  - Other errors, such as a wrong password or an email that is already registered, appear above the form.

## Project structure

```
src/
├── api/                  # Axios client (/api/v1) and the API calls
├── components/ui/        # Buttons, form fields, cards, alerts, spinner
├── features/
│   ├── auth/             # AuthProvider (who is logged in), login and registration pages
│   └── dashboard/        # The protected dashboard
├── layouts/              # Layouts for logged-out pages and logged-in pages
├── pages/                # 404 page
├── routes/guards.tsx     # RequireAuth and GuestOnly
├── types/api.ts          # Types of the API responses
├── utils/                # Labels and date formatting
├── App.tsx               # Routes
└── main.tsx              # Entry point
```
