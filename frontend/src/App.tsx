import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { AuthProvider } from './features/auth/AuthContext';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { AppLayout } from './layouts/AppLayout';
import { AuthLayout } from './layouts/AuthLayout';
import { NotFoundPage } from './pages/NotFoundPage';
import { GuestOnly, RequireAuth } from './routes/guards';

/**
 * The pages of this milestone:
 *
 *   /login       log in                    (only when logged out)
 *   /register    create a citizen account  (only when logged out)
 *   /dashboard   the logged-in user        (only when logged in)
 *
 * "/" sends the user to the dashboard, which sends them to /login if they
 * aren't logged in.
 */
export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<GuestOnly />}>
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
            </Route>
          </Route>

          <Route element={<RequireAuth />}>
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
            </Route>
          </Route>

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
