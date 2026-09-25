import { Navigate, Outlet, useLocation } from 'react-router';
import { LoadingBlock } from '../components/ui/Spinner';
import { useAuth } from '../features/auth/useAuth';

/**
 * Only logged-in users get past this point; others go to the login page.
 * This is for usability only: the backend checks the session on every
 * request, so typing a URL can never bypass it.
 */
export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingBlock label="Checking your session…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

/** Login and registration pages: logged-in users go straight to the dashboard. */
export function GuestOnly() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingBlock />;
  if (user) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
