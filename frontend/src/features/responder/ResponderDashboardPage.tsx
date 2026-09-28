import { Link } from 'react-router';
import { errorMessage } from '../../api/client';
import { respondersApi } from '../../api/endpoints';
import { Alert, Card, EmptyState, PageHeader } from '../../components/ui/Layout';
import { LoadingBlock } from '../../components/ui/Spinner';
import { POLL_INTERVAL_MS } from '../../config';
import { useAsync } from '../../hooks/useAsync';
import { ASSIGNMENT_STATUS_LABELS } from '../../utils/labels';
import { useCurrentUser } from '../auth/useAuth';
import { IncidentMap, type MapPoint } from '../incidents/maps';
import { StatTile } from '../operator/charts';
import { AssignmentCard } from './AssignmentCard';
import { DutyStatusCard } from './DutyStatusCard';
import { useAssignmentActions } from './useAssignmentActions';

/** The responder's home page: duty status, what needs attention now, and where it is. */
export function ResponderDashboardPage() {
  const user = useCurrentUser();
  const profile = useAsync(() => respondersApi.me(), [], { pollMs: POLL_INTERVAL_MS });
  const active = useAsync(() => respondersApi.assignments('active'), [], { pollMs: POLL_INTERVAL_MS });
  const finished = useAsync(() => respondersApi.assignments('history'), [], { pollMs: POLL_INTERVAL_MS });
  const actions = useAssignmentActions(() => Promise.all([active.reload(), profile.reload()]));

  const header = (
    <PageHeader
      title={`Hello, ${user.fullName.split(' ')[0]}`}
      description="Your assignments and duty status. This page updates automatically."
    />
  );

  const error = profile.error ?? active.error;
  if (error) {
    return (
      <>
        {header}
        <Alert>{errorMessage(error)}</Alert>
      </>
    );
  }
  if (!profile.data || !active.data) {
    return (
      <>
        {header}
        <LoadingBlock />
      </>
    );
  }

  const assignments = active.data;
  const count = (status: 'ASSIGNED' | 'ACCEPTED' | 'RESPONDING') => assignments.filter((a) => a.status === status).length;
  const completed = finished.data?.filter((a) => a.status === 'COMPLETED').length;

  const points: MapPoint[] = assignments.map((assignment) => ({
    id: assignment.id,
    latitude: assignment.incident.latitude,
    longitude: assignment.incident.longitude,
    status: assignment.incident.status,
    label: `${assignment.incident.title} · ${ASSIGNMENT_STATUS_LABELS[assignment.status]}`,
    popup: (
      <Link to={`/responder/incidents/${assignment.incident.id}`} className="font-medium text-blue-600">
        {assignment.incident.title} →
      </Link>
    ),
  }));

  return (
    <>
      {header}
      {actions.error && (
        <div className="mb-4">
          <Alert>{actions.error}</Alert>
        </div>
      )}

      <DutyStatusCard me={profile.data} onChanged={() => void profile.reload()} />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Waiting to accept" value={count('ASSIGNED')} detail="New assignments from the operators" />
        <StatTile label="Accepted" value={count('ACCEPTED')} detail="Ready to set off" />
        <StatTile label="Responding" value={count('RESPONDING')} detail="On the way or at the scene" />
        <StatTile label="Completed" value={completed ?? '…'} detail="Recent finished assignments" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card
          title="Current assignments"
          className="lg:col-span-3"
          actions={
            <Link to="/responder/assignments" className="text-sm font-medium text-blue-600 hover:underline">
              All assignments
            </Link>
          }
        >
          {assignments.length === 0 ? (
            <EmptyState
              title="No active assignments"
              description={
                profile.data.availability === 'OFF_DUTY'
                  ? 'You are off duty. Go on duty to receive assignments.'
                  : 'When an operator sends you to an incident, it appears here.'
              }
            />
          ) : (
            <div className="space-y-4">
              {assignments.map((assignment) => (
                <AssignmentCard
                  key={assignment.id}
                  assignment={assignment}
                  busy={actions.busyId === assignment.id}
                  onAccept={() => actions.accept(assignment.id)}
                  onRespond={() => actions.respond(assignment.id)}
                />
              ))}
            </div>
          )}
        </Card>
        <Card title="Where you are needed" className="lg:col-span-2">
          {points.length > 0 ? (
            <IncidentMap points={points} height={380} />
          ) : (
            <p className="text-sm text-slate-500">Your active assignments are shown on this map.</p>
          )}
        </Card>
      </div>
    </>
  );
}
