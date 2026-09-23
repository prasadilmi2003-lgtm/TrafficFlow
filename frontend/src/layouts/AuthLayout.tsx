import { Outlet } from 'react-router';
import { Logo } from './Logo';

export function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 px-4 py-12">
      <div className="mb-8">
        <Logo large />
      </div>
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <Outlet />
      </div>
      <p className="mt-8 text-xs text-slate-500">Smart Traffic Incident &amp; Emergency Response Platform</p>
    </div>
  );
}
