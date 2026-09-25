import { Link } from 'react-router';
import { errorMessage } from '../../api/client';
import { incidentsApi, statsApi } from '../../api/endpoints';
import { AvailabilityBadge } from '../../components/ui/Badge';
import { ButtonLink } from '../../components/ui/Button';
import { Alert, Card, EmptyState, PageHeader } from '../../components/ui/Layout';
import { LoadingBlock } from '../../components/ui/Spinner';
import { POLL_INTERVAL_MS } from '../../config';
import { useAsync } from '../../hooks/useAsync';
import { AVAILABILITIES, INCIDENT_STATUSES, SEVERITIES, type Severity } from '../../types/api';
import { formatDuration, timeAgo } from '../../utils/format';
import { SEVERITY_LABELS, STATUS_LABELS } from '../../utils/labels';
import { CHART_COLORS, DailyColumns, HorizontalBars, StatTile } from './charts';

const SEVERITY_COLORS: Record<Severity, string> = {
  LOW: CHART_COLORS.status.good,
  MEDIUM: CHART_COLORS.status.warning,
  HIGH: CHART_COLORS.status.serious,
  CRITICAL: CHART_COLORS.status.critical,
};

export function DashboardPage() {
  const stats = useAsync(() => statsApi.dashboard(), [], { pollMs: POLL_INTERVAL_MS });
  const waiting = useAsync(() => incidentsApi.list({ status: ['REPORTED'], limit: 5 }), [], { pollMs: POLL_INTERVAL_MS });

  if (stats.error) return <Alert>{errorMessage(stats.error)}</Alert>;
  if (stats.loading || !stats.data) return <LoadingBlock />;
  const data = stats.data;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Live overview of incidents and responders. Updates every 20 seconds."
        actions={<ButtonLink to="/operator/map" variant="secondary">Open live map</ButtonLink>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Open incidents" value={data.openIncidents} detail="Reported, verified, assigned or responding" />
        <StatTile label="Reported (24 h)" value={data.reportedLast24h} />
        <StatTile label="Resolved (24 h)" value={data.resolvedLast24h} />
        <StatTile label="Average time to resolve" value={formatDuration(data.averageResolutionMinutes)} detail="Last 30 days" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card
          title={`Waiting for review (${data.incidentsByStatus.REPORTED})`}
          actions={
            <Link to="/operator/incidents?status=REPORTED" className="text-sm font-medium text-blue-600 hover:underline">
              View all
            </Link>
          }
          className="lg:col-span-2"
        >
          {waiting.data && waiting.data.items.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {waiting.data.items.map((incident) => (
                <li key={incident.id}>
                  <Link to={`/operator/incidents/${incident.id}`} className="flex items-center justify-between gap-4 py-3 hover:bg-slate-50">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">
                        {incident.type.name} <span className="font-normal text-slate-500">· {incident.referenceNo}</span>
                      </p>
                      <p className="truncate text-xs text-slate-500">{incident.locationText ?? incident.description}</p>
                    </div>
                    <span className="shrink-0 text-xs text-slate-500">{timeAgo(incident.createdAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No reports waiting" description="New reports from citizens appear here." />
          )}
        </Card>

        <Card title="Responders">
          <ul className="space-y-3">
            {AVAILABILITIES.map((availability) => (
              <li key={availability} className="flex items-center justify-between">
                <AvailabilityBadge availability={availability} />
                <span className="text-lg font-semibold tabular-nums text-slate-900">{data.respondersByAvailability[availability]}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Last 7 days" className="lg:col-span-2">
          <DailyColumns days={data.last7Days} />
        </Card>

        <Card title="Open incidents by severity">
          <HorizontalBars
            rows={SEVERITIES.map((severity) => ({
              label: SEVERITY_LABELS[severity],
              value: data.openIncidentsBySeverity[severity],
              color: SEVERITY_COLORS[severity],
            }))}
          />
        </Card>

        <Card title="Incidents by status (all time)">
          <HorizontalBars rows={INCIDENT_STATUSES.map((status) => ({ label: STATUS_LABELS[status], value: data.incidentsByStatus[status] }))} />
        </Card>

        <Card title="Incidents by type (30 days)" className="lg:col-span-2">
          <HorizontalBars rows={data.incidentsByTypeLast30Days.map((type) => ({ label: type.name, value: type.count }))} />
        </Card>
      </div>
    </>
  );
}
