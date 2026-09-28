import type { ReactNode } from 'react';
import { SeverityBadge, StatusBadge } from '../components/ui/Badge';
import { ButtonLink } from '../components/ui/Button';
import { AlertIcon, CheckIcon, MapIcon, RadioIcon, ShieldIcon, TruckIcon, UsersIcon } from '../components/ui/icons';
import { Logo } from '../layouts/Logo';
import type { IncidentStatus } from '../types/api';
import { STATUS_LABELS, STATUS_MARKER_COLORS } from '../utils/labels';

const STEPS: Array<{ status: IncidentStatus; title: string; text: string }> = [
  { status: 'REPORTED', title: 'Report', text: 'A citizen reports what happened, marks the spot on the map and can add a photo.' },
  { status: 'VERIFIED', title: 'Verify', text: 'An operator reviews the report, confirms it and sets how serious it is.' },
  { status: 'ASSIGNED', title: 'Dispatch', text: 'The operator sends the right units: police, ambulance, fire service, tow truck.' },
  { status: 'RESOLVED', title: 'Resolve', text: 'Responders accept, head to the scene, post updates and close the incident.' },
];

const ROLES: Array<{ icon: ReactNode; title: string; points: string[] }> = [
  {
    icon: <UsersIcon />,
    title: 'Citizens',
    points: ['Report incidents in under a minute', 'Pin the exact location on the map', 'Follow every step of the response'],
  },
  {
    icon: <RadioIcon />,
    title: 'Operators',
    points: ['One queue for incoming reports', 'Verify or reject with a reason', 'Dispatch several units to one incident'],
  },
  {
    icon: <TruckIcon />,
    title: 'Responders',
    points: ['See assignments as they arrive', 'Accept, respond and add notes', 'Directions to the scene in one tap'],
  },
  {
    icon: <ShieldIcon />,
    title: 'Administrators',
    points: ['Manage users and response units', 'Maintain the list of incident types', 'System-wide statistics'],
  },
];

/** A static preview of an incident as the apps show it. */
function PreviewCard() {
  const timeline: Array<{ status: IncidentStatus; time: string; note: string }> = [
    { status: 'REPORTED', time: '08:12', note: 'Reported by a passer-by with a photo' },
    { status: 'VERIFIED', time: '08:14', note: 'Severity set to High' },
    { status: 'ASSIGNED', time: '08:15', note: 'Assigned POL-01 and AMB-07' },
    { status: 'RESPONDING', time: '08:17', note: 'AMB-07 is on the way' },
  ];
  return (
    <div className="rounded-xl bg-white p-5 shadow-xl ring-1 ring-slate-200" aria-hidden="true">
      <p className="text-xs font-medium text-slate-500">TF-000128 · Accident</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">Two-car collision at Kollupitiya junction</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <StatusBadge status="RESPONDING" />
        <SeverityBadge severity="HIGH" />
      </div>
      <ol className="mt-5 space-y-4 border-l-2 border-slate-100 pl-5">
        {timeline.map((entry) => (
          <li key={entry.status} className="relative">
            <span
              className="absolute -left-[27px] top-1 h-3.5 w-3.5 rounded-full ring-4 ring-white"
              style={{ backgroundColor: STATUS_MARKER_COLORS[entry.status] }}
            />
            <p className="text-sm font-medium text-slate-900">
              {STATUS_LABELS[entry.status]}
              <span className="ml-2 font-normal text-slate-400">{entry.time}</span>
            </p>
            <p className="text-xs text-slate-500">{entry.note}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** The public home page: what TrafficFlow is, how it works, and the way in. */
export function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-100">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Logo />
          <nav className="flex items-center gap-2" aria-label="Account">
            <ButtonLink to="/login" variant="ghost">
              Log in
            </ButtonLink>
            <ButtonLink to="/register">Create account</ButtonLink>
          </nav>
        </div>
      </header>

      <main>
        <section className="bg-gradient-to-b from-slate-50 to-white">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Smart traffic incident response</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
                From the first report to a clear road.
              </h1>
              <p className="mt-5 max-w-xl text-lg text-slate-600">
                TrafficFlow connects the people who see traffic incidents with the operators who coordinate the response and
                the units who clear them, with every step recorded and visible.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink to="/register" className="px-5 py-2.5 text-base">
                  Report an incident
                </ButtonLink>
                <ButtonLink to="/login" variant="secondary" className="px-5 py-2.5 text-base">
                  Staff login
                </ButtonLink>
              </div>
              <p className="mt-6 flex items-start gap-2 text-sm text-slate-500">
                <span className="mt-0.5 text-amber-500">
                  <AlertIcon />
                </span>
                If a life is at risk, call the emergency services first: 119 (police), 1990 (Suwa Seriya ambulance) or 110 (fire).
              </p>
            </div>
            <PreviewCard />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6" aria-labelledby="how-it-works">
          <h2 id="how-it-works" className="text-2xl font-semibold tracking-tight text-slate-900">
            How it works
          </h2>
          <p className="mt-2 max-w-2xl text-slate-600">
            Every incident follows the same lifecycle, and every change is recorded with who made it and when.
          </p>
          <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <li key={step.status} className="rounded-lg p-5 ring-1 ring-slate-200">
                <div className="flex items-center justify-between">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                    {index + 1}
                  </span>
                  <StatusBadge status={step.status} />
                </div>
                <h3 className="mt-4 font-semibold text-slate-900">{step.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="bg-slate-50" aria-labelledby="roles">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 id="roles" className="text-2xl font-semibold tracking-tight text-slate-900">
              One platform, four roles
            </h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {ROLES.map((role) => (
                <div key={role.title} className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                    {role.icon}
                  </span>
                  <h3 className="mt-4 font-semibold text-slate-900">{role.title}</h3>
                  <ul className="mt-3 space-y-2">
                    {role.points.map((point) => (
                      <li key={point} className="flex gap-2 text-sm text-slate-600">
                        <span className="mt-0.5 text-emerald-600">
                          <CheckIcon />
                        </span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-700">
            <MapIcon />
          </span>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">Seen something on the road?</h2>
          <p className="mx-auto mt-2 max-w-xl text-slate-600">
            Create a free citizen account and send your first report. You can follow its progress from your dashboard.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <ButtonLink to="/register">Create account</ButtonLink>
            <ButtonLink to="/login" variant="secondary">
              Log in
            </ButtonLink>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-100">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Logo />
          <p>Smart Traffic Incident &amp; Emergency Response Platform</p>
        </div>
      </footer>
    </div>
  );
}
