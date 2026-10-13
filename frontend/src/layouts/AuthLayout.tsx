import { Link, Outlet } from 'react-router';
import { FieldThemeContext } from '../components/ui/Field';
import { HeroBackdrop } from '../pages/landing/HeroBackdrop';
import { Logo } from './Logo';

/** The dark, night-city frame around the login and register screens, matching the landing page. */
export function AuthLayout() {
  return (
    <div className="relative isolate flex min-h-screen flex-col items-center justify-center overflow-hidden bg-ink-950 px-4 py-12 text-slate-200">
      <HeroBackdrop />
      <Link to="/" aria-label="TrafficFlow home" className="relative z-10 mb-8">
        <Logo large inverted />
      </Link>
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white/[0.06] p-8 shadow-2xl shadow-black/40 ring-1 ring-white/10 backdrop-blur-xl">
        <FieldThemeContext.Provider value="dark">
          <Outlet />
        </FieldThemeContext.Provider>
      </div>
      <p className="relative z-10 mt-8 text-xs text-slate-400">Smart Traffic Incident &amp; Emergency Response Platform</p>
    </div>
  );
}
