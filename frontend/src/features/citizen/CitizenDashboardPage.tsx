import { Link } from 'react-router';
import { errorMessage } from '../../api/client';
import { incidentsApi } from '../../api/endpoints';
import { ButtonLink } from '../../components/ui/Button';
import { Alert, Card, EmptyState, PageHeader } from '../../components/ui/Layout';
import { LoadingBlock } from '../../components/ui/Spinner';
import { POLL_INTERVAL_MS } from '../../config';
import { useAsync } from '../../hooks/useAsync';
import { OPEN_STATUSES } from '../../types/api';
import { STATUS_LABELS } from '../../utils/labels';
import { useCurrentUser } from '../auth/useAuth';
import { IncidentCard } from '../incidents/IncidentCard';
import { IncidentMap, type MapPoint } from '../incidents/maps';
import { StatTile } from '../operator/charts';

/** Loads the citizen's reports: the latest few, the open ones, and how many were resolved. */
async function loadOverview() {
  const [recent, open, resolved] = await Promise.all([
    incidentsApi.listMine({ limit: 5 }),
    incidentsApi.listMine({ status: OPEN_STATUSES, limit: 50 }),
    incidentsApi.listMine({ status: ['RESOLVED'], limit: 1 }),
  ]);
  const total = recent.pagination.total;
  return {
    recent: recent.items,
    open: open.items,
    counts: {
      total,
      open: open.pagination.total,
      resolved: resolved.pagination.total,
      rejected: total - open.pagination.total - resolved.pagination.total,
    },
  };
}

/** The citizen's home page: their reports at a glance and a quick way to report another. */
export function CitizenDashboardPage() {
  const user = useCurrentUser();
  const overview = useAsync(loadOverview, [], { pollMs: POLL_INTERVAL_MS });
  const firstName = user.fullName.split(' ')[0];

  const header = (
    <PageHeader
      title={`Hello, ${firstName}`}
      description="Report traffic incidents and follow how the response is going. This page updates automatically."
      actions={<ButtonLink to="/citizen/report">Report an incident</ButtonLink>}
    />
  );

  if (overview.error) {
    return (
      <>
        {header}
        <Alert>{errorMessage(overview.error)}</Alert>
      </>
    );
  }
  if (overview.loading || !overview.data) {
    return (
      <>
        {header}
        <LoadingBlock />
      </>
    );
  }

  const { recent, open, counts } = overview.data;
  const points: MapPoint[] = open.map((incident) => ({
    id: incident.id,
    latitude: incident.latitude,
    longitude: incident.longitude,
    status: incident.status,
    label: `${incident.title} · ${STATUS_LABELS[incident.status]}`,
    popup: (
      <Link to={`/citizen/incidents/${incident.id}`} className="font-medium text-blue-600">
        {incident.title} →
      </Link>
    ),
  }));

  return (
    <>
      {header}

      {counts.total === 0 ? (
        <EmptyState
          title="You haven't reported any incidents yet"
          description="Seen an accident, a blocked road, flooding or a hazard? Report it with its location and an optional photo, and follow the response here."
          action={<ButtonLink to="/citizen/report">Report your first incident</ButtonLink>}
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label="Reports" value={counts.total} detail="Everything you have reported" />
            <StatTile label="In progress" value={counts.open} detail="Being reviewed or handled" />
            <StatTile label="Resolved" value={counts.resolved} />
            <StatTile label="Rejected" value={counts.rejected} detail="Closed after review, with a reason" />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
            <Card
              title="Latest reports"
              className="lg:col-span-3"
              actions={
                <Link to="/citizen/incidents" className="text-sm font-medium text-blue-600 hover:underline">
                  View all
                </Link>
              }
            >
              <div className="space-y-3">
                {recent.map((incident) => (
                  <IncidentCard key={incident.id} incident={incident} to={`/citizen/incidents/${incident.id}`} />
                ))}
              </div>
            </Card>
            <Card title={`Open reports on the map (${counts.open})`} className="lg:col-span-2">
              {points.length > 0 ? (
                <IncidentMap points={points} height={360} />
              ) : (
                <p className="text-sm text-slate-500">None of your reports are open right now.</p>
              )}
            </Card>
          </div>
        </>
      )}
    </>
  );
}
