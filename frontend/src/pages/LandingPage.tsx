import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  AlertIcon,
  ArrowRightIcon,
  BoltIcon,
  CameraIcon,
  ChartBarIcon,
  CheckIcon,
  ClockIcon,
  EyeIcon,
  ListIcon,
  MapIcon,
  PhoneIcon,
  PulseIcon,
  RadioIcon,
  ShieldIcon,
  TruckIcon,
  UsersIcon,
} from '../components/ui/icons';
import { Logo } from '../layouts/Logo';
import { HeroBackdrop } from './landing/HeroBackdrop';
import { LiveIncidentsCard, RecentIncidentCard } from './landing/LivePanel';

const NAV: Array<{ id: string; label: string }> = [
  { id: 'top', label: 'Home' },
  { id: 'about', label: 'About' },
  { id: 'how-it-works', label: 'How it works' },
  { id: 'features', label: 'Features' },
  { id: 'contact', label: 'Contact' },
];

const BENEFITS: Array<{ icon: ReactNode; tint: string; title: string; text: string }> = [
  { icon: <BoltIcon className="h-6 w-6" />, tint: 'bg-blue-600 text-white', title: 'Faster response', text: 'Get help to the right place, faster.' },
  { icon: <EyeIcon className="h-6 w-6" />, tint: 'bg-emerald-600 text-white', title: 'Real-time visibility', text: 'See the status of every incident.' },
  { icon: <ShieldIcon className="h-6 w-6" />, tint: 'bg-amber-500 text-white', title: 'Safer communities', text: 'Work together for safer roads.' },
  { icon: <ChartBarIcon className="h-6 w-6" />, tint: 'bg-indigo-600 text-white', title: 'Data-driven decisions', text: 'Turn reports into real improvements.' },
];

const STEPS = [
  { title: 'Report', color: 'bg-orange-500', text: 'A citizen reports what happened, marks the spot on the map and can add a photo.' },
  { title: 'Verify', color: 'bg-blue-500', text: 'An operator reviews the report, confirms it and sets how serious it is.' },
  { title: 'Dispatch', color: 'bg-violet-600', text: 'The operator sends the right units: police, ambulance, fire service, tow truck.' },
  { title: 'Resolve', color: 'bg-emerald-500', text: 'Responders accept, head to the scene, post updates and close the incident.' },
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

const FEATURES: Array<{ icon: ReactNode; title: string; text: string }> = [
  { icon: <MapIcon />, title: 'Pin it on the map', text: 'Every report carries its exact location, so units go straight to the right spot.' },
  { icon: <CameraIcon />, title: 'Photo evidence', text: 'Citizens can attach photos that help operators judge how serious an incident is.' },
  { icon: <ClockIcon />, title: 'A full timeline', text: 'Each change is recorded with who made it and when, and everyone can follow it.' },
  { icon: <ListIcon />, title: 'One operator queue', text: 'New reports land in a single queue, ready to be verified, rejected or dispatched.' },
  { icon: <UsersIcon />, title: 'Several units, one incident', text: 'Send police, an ambulance and a tow truck to the same incident and track each one.' },
  { icon: <ChartBarIcon />, title: 'Statistics', text: 'System-wide numbers help administrators spot patterns and improve response.' },
];

/** Highlights the nav link of the section currently in view. */
function useActiveSection(ids: string[]): string {
  const [active, setActive] = useState(ids[0] ?? '');
  const key = ids.join(',');
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: '-35% 0px -60% 0px' },
    );
    for (const id of key.split(',')) {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [key]);
  return active;
}

const PRIMARY_BUTTON =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 font-semibold text-white shadow-lg shadow-blue-600/30 transition hover:from-blue-400 hover:to-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400';
const SECONDARY_BUTTON =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-white/[0.06] font-semibold text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400';

function SectionHeading({ id, title, children }: { id: string; title: string; children?: ReactNode }) {
  return (
    <div>
      <h2 id={id} className="text-3xl font-semibold tracking-tight text-white">
        {title}
      </h2>
      {children && <p className="mt-3 max-w-2xl text-slate-400">{children}</p>}
    </div>
  );
}

/** The public home page: what TrafficFlow is, how it works, and the way in. */
export function LandingPage() {
  const active = useActiveSection(NAV.map((item) => item.id));

  return (
    <div className="min-h-screen bg-ink-950 text-slate-200">
      <div id="top" className="relative isolate overflow-hidden">
        <HeroBackdrop />

        <header className="relative z-20 px-4 pt-4 sm:px-6 lg:px-10">
          <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 rounded-2xl bg-white/[0.05] px-4 py-3 ring-1 ring-white/10 backdrop-blur-xl sm:px-6">
            <a href="#top" aria-label="TrafficFlow home">
              <Logo inverted />
            </a>
            <nav className="hidden items-center gap-9 text-[15px] font-medium text-slate-300 lg:flex" aria-label="Sections">
              {NAV.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  aria-current={active === item.id ? 'true' : undefined}
                  className={`border-b-2 py-1 transition-colors hover:text-white ${
                    active === item.id ? 'border-sky-400 text-white' : 'border-transparent'
                  }`}
                >
                  {item.label}
                </a>
              ))}
            </nav>
            <div className="flex items-center gap-2 sm:gap-4">
              <Link to="/login" className="whitespace-nowrap rounded-lg px-2 py-2 text-sm font-medium text-white hover:text-sky-300 sm:px-3 sm:text-[15px]">
                Log in
              </Link>
              <Link to="/register" className={`${PRIMARY_BUTTON} whitespace-nowrap px-3 py-2.5 text-sm sm:px-5 sm:text-[15px]`}>
                Create account
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </header>

        <main className="relative z-10 mx-auto grid max-w-[1400px] gap-10 px-4 pb-14 pt-14 sm:px-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-6 lg:px-10 lg:pt-16">
          <div>
            <p className="inline-flex items-center gap-2.5 rounded-full bg-sky-400/5 px-5 py-2.5 text-xs font-medium uppercase tracking-wide text-slate-200 ring-1 ring-sky-400/50 sm:text-sm">
              <PulseIcon className="h-5 w-5 text-sky-400" />
              Smart traffic incident response
            </p>
            <h1 className="mt-7 text-5xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl xl:text-7xl">
              From the first report to a{' '}
              <span className="bg-gradient-to-r from-blue-500 to-cyan-300 bg-clip-text text-transparent">clearer,</span>{' '}
              <span className="bg-gradient-to-r from-orange-500 to-amber-300 bg-clip-text text-transparent">safer road.</span>
            </h1>
            <p className="mt-7 max-w-[640px] text-lg leading-relaxed text-slate-300/90">
              TrafficFlow connects the people who see traffic incidents with the operators who coordinate the response and the
              units who clear them, with every step recorded and visible.
            </p>
            <div className="mt-9 flex flex-wrap gap-4">
              <Link to="/register" className={`${PRIMARY_BUTTON} px-7 py-4 text-lg`}>
                <AlertIcon className="h-6 w-6" />
                Report an incident
                <ArrowRightIcon className="h-5 w-5" />
              </Link>
              <Link to="/login" className={`${SECONDARY_BUTTON} px-7 py-4 text-lg`}>
                <UsersIcon className="h-6 w-6" />
                Staff login
              </Link>
            </div>

            <div className="mt-8 flex max-w-[620px] items-center gap-4 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10 backdrop-blur">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-600 text-white">
                <PhoneIcon className="h-6 w-6" />
              </span>
              <p className="text-white">
                If a life is at risk, call the emergency services first:
                <br />
                <span className="font-medium text-red-500">119</span> (police), <span className="font-medium text-red-500">1990</span>{' '}
                (Suwa Seriya ambulance) or <span className="font-medium text-red-500">110</span> (fire).
              </p>
            </div>

            <ul className="mt-9 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Benefits">
              {BENEFITS.map((benefit) => (
                <li key={benefit.title} className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10 backdrop-blur">
                  <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${benefit.tint}`}>{benefit.icon}</span>
                  <p className="mt-3 font-semibold leading-snug text-white">{benefit.title}</p>
                  <p className="mt-1 text-sm text-slate-400">{benefit.text}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative lg:pt-4" aria-hidden="true">
            <LiveIncidentsCard className="w-full max-w-xs lg:ml-auto" />
            <RecentIncidentCard className="mt-4 lg:mt-6" />
            <p className="mt-4 flex w-fit items-center gap-3 rounded-2xl bg-white/[0.06] px-5 py-3 text-sm font-medium text-sky-300 ring-1 ring-white/15 backdrop-blur-xl lg:ml-auto">
              <UsersIcon className="h-6 w-6" />
              Building safer roads
              <br className="hidden sm:block" />
              together
            </p>
          </div>
        </main>
      </div>

      <section id="about" className="scroll-mt-6 bg-ink-900 py-20" aria-labelledby="about-title">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
          <SectionHeading id="about-title" title="One platform, four roles">
            Everyone in the response chain works from the same record, so nobody has to ask what is happening.
          </SectionHeading>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {ROLES.map((role) => (
              <div key={role.title} className="rounded-2xl bg-white/[0.04] p-6 ring-1 ring-white/10">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-sky-400/10 text-sky-300">
                  {role.icon}
                </span>
                <h3 className="mt-5 text-lg font-semibold text-white">{role.title}</h3>
                <ul className="mt-4 space-y-2.5">
                  {role.points.map((point) => (
                    <li key={point} className="flex gap-2.5 text-sm text-slate-400">
                      <span className="mt-0.5 text-emerald-400">
                        <CheckIcon className="h-4 w-4" />
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

      <section id="how-it-works" className="scroll-mt-6 py-20" aria-labelledby="how-title">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
          <SectionHeading id="how-title" title="How it works">
            Every incident follows the same lifecycle, and every change is recorded with who made it and when.
          </SectionHeading>
          <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <li key={step.title} className="rounded-2xl bg-white/[0.04] p-6 ring-1 ring-white/10">
                <span className={`flex h-10 w-10 items-center justify-center rounded-full text-base font-semibold text-white ${step.color}`}>
                  {index + 1}
                </span>
                <h3 className="mt-5 text-lg font-semibold text-white">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="features" className="scroll-mt-6 bg-ink-900 py-20" aria-labelledby="features-title">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
          <SectionHeading id="features-title" title="Built for the whole response" />
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="flex gap-4 rounded-2xl bg-white/[0.04] p-6 ring-1 ring-white/10">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                  {feature.icon}
                </span>
                <div>
                  <h3 className="font-semibold text-white">{feature.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{feature.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className="scroll-mt-6 px-4 py-24 text-center sm:px-6" aria-labelledby="contact-title">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-sky-400/10 text-sky-300">
          <MapIcon className="h-7 w-7" />
        </span>
        <h2 id="contact-title" className="mt-5 text-3xl font-semibold tracking-tight text-white">
          Seen something on the road?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-slate-400">
          Create a free citizen account and send your first report. You can follow its progress from your dashboard.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/register" className={`${PRIMARY_BUTTON} px-6 py-3`}>
            Create account
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
          <Link to="/login" className={`${SECONDARY_BUTTON} px-6 py-3`}>
            Log in
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-4 py-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-10">
          <Logo inverted />
          <p>Smart Traffic Incident &amp; Emergency Response Platform</p>
        </div>
      </footer>
    </div>
  );
}
