import { errorMessage } from '../../api/client';
import { statsApi } from '../../api/endpoints';
import { Alert, Card, Detail, PageHeader } from '../../components/ui/Layout';
import { LoadingBlock } from '../../components/ui/Spinner';
import { POLL_INTERVAL_MS } from '../../config';
import { useAsync } from '../../hooks/useAsync';
import { INCIDENT_STATUSES, ROLES } from '../../types/api';
import { formatUptime } from '../../utils/format';
import { ROLE_LABELS, STATUS_LABELS } from '../../utils/labels';
import { HorizontalBars, StatTile } from '../operator/charts';

export function SystemOverviewPage() {
  const stats = useAsync(() => statsApi.system(), [], { pollMs: POLL_INTERVAL_MS });

  if (stats.error) return <Alert>{errorMessage(stats.error)}</Alert>;
  if (stats.loading || !stats.data) return <LoadingBlock />;
  const data = stats.data;

  return (
    <>
      <PageHeader title="System overview" description="Accounts, incidents and service health across the whole platform." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Users" value={data.users.total} detail={`${data.users.active} active · ${data.users.inactive} deactivated`} />
        <StatTile label="Incidents" value={data.incidents.total} detail={`${data.incidents.last30Days} in the last 30 days`} />
        <StatTile label="Assignments" value={data.assignments.total} detail={`${data.assignments.active} in progress`} />
        <StatTile label="Incident types" value={data.incidentTypes.active} detail={`${data.incidentTypes.inactive} deactivated`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Users by role">
          <HorizontalBars rows={ROLES.map((role) => ({ label: ROLE_LABELS[role], value: data.users.byRole[role] }))} />
        </Card>
        <Card title="Incidents by status">
          <HorizontalBars rows={INCIDENT_STATUSES.map((status) => ({ label: STATUS_LABELS[status], value: data.incidents.byStatus[status] }))} />
        </Card>
        <Card title="Backend service">
          <dl className="space-y-4">
            <Detail label="Version">{data.service.version}</Detail>
            <Detail label="Node.js">{data.service.nodeVersion}</Detail>
            <Detail label="Uptime">{formatUptime(data.service.uptimeSeconds)}</Detail>
          </dl>
        </Card>
      </div>
    </>
  );
}
