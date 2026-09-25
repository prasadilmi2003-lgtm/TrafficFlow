import { Outlet, useNavigate } from 'react-router';
import { RoleBadge } from '../components/ui/Badge';
import { LogoutIcon } from '../components/ui/icons';
import { useAuth, useCurrentUser } from '../features/auth/useAuth';
import { Logo } from './Logo';

/** Shell for logged-in pages: a top bar with the user and a Log out button, then the page. */
export function AppLayout() {
  const user = useCurrentUser();
  const { logout } = useAuth();
  const navigate = useNavigate();

  async function onLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen">
      <header className="bg-slate-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Logo inverted />
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-white">{user.fullName}</p>
              <p className="text-xs text-slate-400">{user.email}</p>
            </div>
            <RoleBadge role={user.role} />
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              <LogoutIcon />
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
