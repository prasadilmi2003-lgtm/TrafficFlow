import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { errorMessage } from '../../api/client';
import { incidentsApi, statsApi } from '../../api/endpoints';
import { SeverityBadge, StatusBadge } from '../../components/ui/Badge';
import { ChartIcon, MapIcon, TagIcon, TruckIcon, UsersIcon } from '../../components/ui/icons';
import { Alert, Card, EmptyState, PageHeader } from '../../components/ui/Layout';
import { LoadingBlock } from '../../components/ui/Spinner';
import { POLL_INTERVAL_MS } from '../../config';
import { useAsync } from '../../hooks/useAsync';
import { timeAgo } from '../../utils/format';
import { StatTile } from '../operator/charts';

const SHORTCUTS: Array<{ to: string; title: string; text: string; icon: ReactNode }> = [
  { to: '/admin/users', title: 'Users', text: 'Create operator, responder and admin accounts; deactivate accounts', icon: <UsersIcon /> },
  { to: '/admin/responders', title: 'Responders', text: 'Response units, their vehicles and availability', icon: <TruckIcon /> },
  { to: '/admin/incident-types', title: 'Incident types', text: 'What citizens can report, with default severities', icon: <TagIcon /> },
  { to: '/admin/statistics', title: 'Statistics', text: 'Trends, workload and service health', icon: <ChartIcon /> },
  { to: '/admin/map', title: 'Live map', text: 'Every open incident on one map', icon: <MapIcon /> },
];

/** The admin's home page: the state of the platform and shortcuts to everything they manage. */
export function AdminDashboardPage() {
  const system = useAsync(() => statsApi.system(), [], { pollMs: POLL_INTERVAL_MS });
  const live = useAsync(() => statsApi.dashboard(), [], { pollMs: POLL_INTERVAL_MS });
  const recent = useAsync(() => incidentsApi.list({ limit: 6 }), [], { pollMs: POLL_INTERVAL_MS });

  const error = system.error ?? live.error;
  if (error) return <Alert>{errorMessage(error)}</Alert>;
  if (!system.data || !live.data) return <LoadingBlock />;
  const s = system.data;
  const d = live.data;

  return (
    <>
      <PageHeader title="Admin dashboard" description="The whole platform at a glance. Updates every 20 seconds." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Active users" value={s.users.active} detail={`${s.users.byRole.CITIZEN} citizens · ${s.users.byRole.RESPONDER} responders`} />
        <StatTile label="Open incidents" value={d.openIncidents} detail={`${d.incidentsByStatus.REPORTED} waiting for review`} />
        <StatTile label="Assignments in progress" value={s.assignments.active} detail={`${s.assignments.total} in total`} />
        <StatTile
          label="Responders available"
          value={d.respondersByAvailability.AVAILABLE}
          detail={`${d.respondersByAvailability.BUSY} busy · ${d.respondersByAvailability.OFF_DUTY} off duty`}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card
          title="Latest incidents"
          className="lg:col-span-2"
          actions={
            <Link to="/admin/incidents" className="text-sm font-medium text-blue-600 hover:underline">
              All incidents
            </Link>
          }
        >
          {recent.error ? (
            <Alert>{errorMessage(recent.error)}</Alert>
          ) : !recent.data ? (
            <LoadingBlock />
          ) : recent.data.items.length === 0 ? (
            <EmptyState title="No incidents yet" description="Reports from citizens appear here." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {recent.data.items.map((incident) => (
                <li key={incident.id}>
                  <Link to={`/admin/incidents/${incident.id}`} className="flex flex-wrap items-center justify-between gap-3 py-3 hover:bg-slate-50">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{incident.title}</p>
                      <p className="text-xs text-slate-500">
                        {incident.referenceNo} · {incident.type.name} · {timeAgo(incident.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {incident.severity && <SeverityBadge severity={incident.severity} />}
                      <StatusBadge status={incident.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Manage">
          <ul className="space-y-1">
            {SHORTCUTS.map((shortcut) => (
              <li key={shortcut.to}>
                <Link to={shortcut.to} className="flex items-start gap-3 rounded-md p-2 hover:bg-slate-50">
                  <span className="mt-0.5 text-blue-700">{shortcut.icon}</span>
                  <span>
                    <span className="block text-sm font-medium text-slate-900">{shortcut.title}</span>
                    <span className="block text-xs text-slate-500">{shortcut.text}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
