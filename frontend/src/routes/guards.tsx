import { Navigate, Outlet, useLocation } from 'react-router';
import { LoadingBlock } from '../components/ui/Spinner';
import { useAuth } from '../features/auth/useAuth';
import type { Role } from '../types/api';
import { homePathForRole } from '../utils/labels';

/** Only logged-in users get past this point; others go to the login page. */
export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingBlock label="Checking your session…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

/**
 * Only the given roles may open these pages; everyone else is sent to their
 * own home page. This is for usability only: the backend checks every
 * request, so typing a URL can never bypass it.
 */
export function RequireRole({ roles }: { roles: Role[] }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to={homePathForRole(user.role)} replace />;
  return <Outlet />;
}

/** Login and registration pages: logged-in users go straight to their home page. */
export function GuestOnly() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingBlock />;
  if (user) return <Navigate to={homePathForRole(user.role)} replace />;
  return <Outlet />;
}

export function HomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={user ? homePathForRole(user.role) : '/login'} replace />;
}
