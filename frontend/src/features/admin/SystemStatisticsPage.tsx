import { errorMessage } from '../../api/client';
import { statsApi } from '../../api/endpoints';
import { Alert, Card, Detail, PageHeader } from '../../components/ui/Layout';
import { LoadingBlock } from '../../components/ui/Spinner';
import { POLL_INTERVAL_MS } from '../../config';
import { useAsync } from '../../hooks/useAsync';
import { AVAILABILITIES, INCIDENT_STATUSES, ROLES, SEVERITIES, type Severity } from '../../types/api';
import { formatDuration, formatUptime } from '../../utils/format';
import { AVAILABILITY_LABELS, ROLE_LABELS, SEVERITY_LABELS, STATUS_LABELS } from '../../utils/labels';
import { CHART_COLORS, DailyColumns, HorizontalBars, StatTile } from '../operator/charts';

const SEVERITY_COLORS: Record<Severity, string> = {
  LOW: CHART_COLORS.status.good,
  MEDIUM: CHART_COLORS.status.warning,
  HIGH: CHART_COLORS.status.serious,
  CRITICAL: CHART_COLORS.status.critical,
};

/** System-wide statistics for admins: accounts, incidents, response times, units and the backend service. */
export function SystemStatisticsPage() {
  const system = useAsync(() => statsApi.system(), [], { pollMs: POLL_INTERVAL_MS });
  const live = useAsync(() => statsApi.dashboard(), [], { pollMs: POLL_INTERVAL_MS });

  const error = system.error ?? live.error;
  if (error) return <Alert>{errorMessage(error)}</Alert>;
  if (!system.data || !live.data) return <LoadingBlock />;
  const s = system.data;
  const d = live.data;

  return (
    <>
      <PageHeader title="Statistics" description="Accounts, incidents, response times and service health across the whole platform." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Users" value={s.users.total} detail={`${s.users.active} active · ${s.users.inactive} deactivated`} />
        <StatTile label="Incidents" value={s.incidents.total} detail={`${s.incidents.last30Days} in the last 30 days`} />
        <StatTile label="Assignments" value={s.assignments.total} detail={`${s.assignments.active} in progress`} />
        <StatTile label="Average time to resolve" value={formatDuration(d.averageResolutionMinutes)} detail="Last 30 days" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title="Last 7 days" className="lg:col-span-2">
          <DailyColumns days={d.last7Days} />
        </Card>
        <Card title="Open incidents by severity">
          <HorizontalBars
            rows={SEVERITIES.map((severity) => ({
              label: SEVERITY_LABELS[severity],
              value: d.openIncidentsBySeverity[severity],
              color: SEVERITY_COLORS[severity],
            }))}
          />
        </Card>
        <Card title="Incidents by type (30 days)" className="lg:col-span-2">
          <HorizontalBars rows={d.incidentsByTypeLast30Days.map((type) => ({ label: type.name, value: type.count }))} />
        </Card>
        <Card title="Incidents by status (all time)">
          <HorizontalBars rows={INCIDENT_STATUSES.map((status) => ({ label: STATUS_LABELS[status], value: s.incidents.byStatus[status] }))} />
        </Card>
        <Card title="Users by role">
          <HorizontalBars rows={ROLES.map((role) => ({ label: ROLE_LABELS[role], value: s.users.byRole[role] }))} />
        </Card>
        <Card title="Responders by availability">
          <HorizontalBars
            rows={AVAILABILITIES.map((availability) => ({
              label: AVAILABILITY_LABELS[availability],
              value: d.respondersByAvailability[availability],
            }))}
          />
        </Card>
        <Card title="Backend service">
          <dl className="space-y-4">
            <Detail label="Version">{s.service.version}</Detail>
            <Detail label="Node.js">{s.service.nodeVersion}</Detail>
            <Detail label="Uptime">{formatUptime(s.service.uptimeSeconds)}</Detail>
            <Detail label="Incident types">
              {s.incidentTypes.active} active · {s.incidentTypes.inactive} deactivated
            </Detail>
          </dl>
        </Card>
      </div>
    </>
  );
}
