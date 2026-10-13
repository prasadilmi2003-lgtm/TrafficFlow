import type { ReactNode } from 'react';
import { AlertIcon, ArrowRightIcon, CheckIcon, ClockIcon, DocumentIcon, PinIcon, TruckIcon, UsersIcon } from '../../components/ui/icons';

const GLASS = 'bg-white/[0.06] ring-1 ring-white/15 backdrop-blur-xl';

const TIMELINE: Array<{ icon: ReactNode; color: string; title: string; time: string; note: string }> = [
  { icon: <DocumentIcon className="h-4 w-4" />, color: 'bg-orange-500', title: 'Reported', time: '08:12', note: 'Reported by a passer-by with a photo' },
  { icon: <CheckIcon className="h-4 w-4" />, color: 'bg-blue-500', title: 'Verified', time: '08:14', note: 'Severity set to High' },
  { icon: <UsersIcon className="h-4 w-4" />, color: 'bg-violet-600', title: 'Assigned', time: '08:15', note: 'Assigned POL-01 and AMB-07' },
  { icon: <TruckIcon className="h-4 w-4" />, color: 'bg-emerald-500', title: 'Responding', time: '08:17', note: 'AMB-07 is on the way' },
];

/** A tiny drawing of two cars, standing in for an incident photo. */
function CarsPicture({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 80" className={className} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="cars-sky" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#3b3a6e" />
          <stop offset="0.55" stopColor="#c0603f" />
          <stop offset="0.56" stopColor="#1a2238" />
          <stop offset="1" stopColor="#0b1224" />
        </linearGradient>
      </defs>
      <rect width="120" height="80" fill="url(#cars-sky)" />
      <path d="M0 44h120v36H0z" fill="#121a2e" />
      <g>
        <path d="M8 62c0-8 5-14 12-15l14-3c6-1 12 0 16 4l6 5c4 1 6 4 6 9v3H8v-3Z" fill="#3a4a7a" />
        <path d="M22 50l10-3c5-1 9 0 12 3l-22 1Z" fill="#6c7aa8" opacity="0.6" />
        <circle cx="22" cy="67" r="5" fill="#05080f" />
        <circle cx="52" cy="67" r="5" fill="#05080f" />
        <rect x="9" y="58" width="5" height="3" rx="1" fill="#ff4d4d" />
      </g>
      <g>
        <path d="M56 64c0-8 5-14 12-15l16-3c7-1 13 0 17 4l6 5c4 1 6 4 6 9v3H56v-3Z" fill="#5a4a63" />
        <path d="M72 52l11-3c5-1 10 0 13 3l-24 1Z" fill="#8c98c4" opacity="0.5" />
        <circle cx="72" cy="69" r="5" fill="#05080f" />
        <circle cx="102" cy="69" r="5" fill="#05080f" />
        <rect x="112" y="60" width="5" height="3" rx="1" fill="#ffb347" />
      </g>
    </svg>
  );
}

/** Small decorative street map with a red marker for the live incidents card. */
function MiniMap() {
  return (
    <svg viewBox="0 0 120 100" className="h-full w-full" aria-hidden="true">
      <g fill="none" stroke="#38bdf8" strokeOpacity="0.55" strokeWidth="0.8">
        <path d="M0 70 C 30 60, 50 50, 120 20" />
        <path d="M20 100 C 40 70, 60 60, 80 0" />
        <path d="M0 40 C 40 45, 70 70, 120 90" />
        <path d="M60 100 L 90 40 L 120 50" />
        <path d="M10 10 L 50 40 L 70 30" />
      </g>
      <g transform="translate(78 34)">
        <path d="M0 14C-6 7-8 3-8 0a8 8 0 0 1 16 0c0 3-2 7-8 14Z" fill="#ef4444" />
        <circle cy="0" r="3" fill="#fff" />
      </g>
    </svg>
  );
}

/** The "Live incidents" counter shown at the top right of the hero. */
export function LiveIncidentsCard({ className = '' }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl p-5 ${GLASS} ${className}`}>
      <div className="absolute inset-y-0 right-0 w-1/2 opacity-80">
        <MiniMap />
      </div>
      <p className="relative flex items-center justify-between text-sm font-medium text-slate-200">Live Incidents</p>
      <p className="relative mt-2 text-5xl font-semibold tracking-tight text-white">12</p>
      <p className="relative mt-1 flex items-center gap-2 text-sm text-slate-300">
        <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.6)]" />
        Active
      </p>
    </div>
  );
}

/** A sample incident with its response timeline, as the apps show one. */
export function RecentIncidentCard({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-3xl p-6 shadow-2xl shadow-black/40 ${GLASS} ${className}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Recent Incident</h2>
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-400">
          View all <ArrowRightIcon className="h-4 w-4" />
        </span>
      </div>

      <div className="mt-5 flex gap-4">
        <CarsPicture className="h-24 w-28 shrink-0 rounded-xl ring-1 ring-white/15 sm:h-28 sm:w-32" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-xs text-slate-400">TF-000128</span>
            <span className="inline-flex items-center gap-1 rounded-md bg-red-600/90 px-2 py-0.5 text-xs font-medium text-white">
              <AlertIcon className="h-3 w-3" />
              High severity
            </span>
          </div>
          <p className="mt-1.5 text-lg font-semibold leading-snug text-white">Two-car collision at Kollupitiya junction</p>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1">
              <PinIcon className="h-3.5 w-3.5" /> Kollupitiya Junction, Colombo 03
            </span>
            <span className="inline-flex items-center gap-1">
              <ClockIcon className="h-3.5 w-3.5" /> Today, 08:12
            </span>
          </p>
        </div>
      </div>

      <ol className="mt-6 space-y-5 border-t border-white/10 pt-6">
        {TIMELINE.map((entry, index) => (
          <li key={entry.title} className="relative flex items-start gap-4">
            {index < TIMELINE.length - 1 && <span className="absolute left-5 top-11 h-5 w-px bg-white/15" />}
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white ${entry.color}`}>
              {entry.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-white">
                {entry.title} <span className="ml-1.5 text-sm font-normal text-slate-400">{entry.time}</span>
              </p>
              <p className="text-sm text-slate-400">{entry.note}</p>
            </div>
            {index === 0 && (
              <div className="hidden shrink-0 gap-1 sm:flex">
                <CarsPicture className="h-12 w-14 rounded-lg ring-1 ring-white/15" />
                <span className="flex h-12 w-14 items-center justify-center rounded-lg bg-white/10 text-sm font-medium text-white ring-1 ring-white/15">
                  +2
                </span>
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
