import { useState, type ReactNode } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { RoleBadge } from '../components/ui/Badge';
import {
  ChartIcon,
  CloseIcon,
  InboxIcon,
  ListIcon,
  LogoutIcon,
  MapIcon,
  MenuIcon,
  PlusIcon,
  TagIcon,
  TruckIcon,
  UsersIcon,
} from '../components/ui/icons';
import { useCurrentUser, useAuth } from '../features/auth/useAuth';
import type { Role } from '../types/api';
import { Logo } from './Logo';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  /** Match the path exactly (for section home pages) */
  end?: boolean;
}

/** Each role sees only its own section of the app. */
const NAVIGATION: Record<Role, NavItem[]> = {
  CITIZEN: [
    { to: '/citizen', label: 'My reports', icon: <ListIcon />, end: true },
    { to: '/citizen/report', label: 'Report an incident', icon: <PlusIcon /> },
  ],
  OPERATOR: [
    { to: '/operator', label: 'Dashboard', icon: <ChartIcon />, end: true },
    { to: '/operator/incidents', label: 'Incidents', icon: <InboxIcon /> },
    { to: '/operator/map', label: 'Live map', icon: <MapIcon /> },
  ],
  RESPONDER: [{ to: '/responder', label: 'My assignments', icon: <TruckIcon />, end: true }],
  ADMIN: [
    { to: '/admin', label: 'System overview', icon: <ChartIcon />, end: true },
    { to: '/admin/incidents', label: 'Incidents', icon: <InboxIcon /> },
    { to: '/admin/map', label: 'Live map', icon: <MapIcon /> },
    { to: '/admin/users', label: 'Users', icon: <UsersIcon /> },
    { to: '/admin/responders', label: 'Responders', icon: <TruckIcon /> },
    { to: '/admin/incident-types', label: 'Incident types', icon: <TagIcon /> },
  ],
};

function Navigation({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  return (
    <nav className="space-y-1" aria-label="Main">
      {NAVIGATION[role].map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              isActive ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
            }`
          }
        >
          {item.icon}
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

function UserPanel({ onLogout }: { onLogout: () => void }) {
  const user = useCurrentUser();
  return (
    <div className="border-t border-slate-800 pt-4">
      <p className="truncate text-sm font-medium text-white">{user.fullName}</p>
      <p className="truncate text-xs text-slate-400">{user.email}</p>
      <div className="mt-2 flex items-center justify-between">
        <RoleBadge role={user.role} />
        <button
          type="button"
          onClick={onLogout}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
        >
          <LogoutIcon />
          Log out
        </button>
      </div>
    </div>
  );
}

/** Shell for every logged-in page: sidebar navigation (a slide-out menu on phones) and the page content. */
export function AppLayout() {
  const user = useCurrentUser();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  async function onLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  const sidebar = (
    <div className="flex h-full flex-col gap-6 bg-slate-900 px-4 py-5">
      <Logo inverted />
      <div className="flex-1">
        <Navigation role={user.role} onNavigate={() => setMenuOpen(false)} />
      </div>
      <UserPanel onLogout={onLogout} />
    </div>
  );

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 lg:block">{sidebar}</aside>

      {/* Phone: top bar with a slide-out menu */}
      <div className="sticky top-0 z-[1500] flex items-center justify-between bg-slate-900 px-4 py-3 lg:hidden">
        <Logo inverted />
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="rounded-md p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white"
          aria-label="Open menu"
        >
          <MenuIcon />
        </button>
      </div>
      {menuOpen && (
        <div className="fixed inset-0 z-[1500] lg:hidden">
          <div className="absolute inset-0 bg-slate-900/60" onClick={() => setMenuOpen(false)} aria-hidden="true" />
          <div className="absolute inset-y-0 left-0 w-72">
            {sidebar}
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="absolute right-3 top-4 rounded-md p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white"
              aria-label="Close menu"
            >
              <CloseIcon />
            </button>
          </div>
        </div>
      )}

      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
