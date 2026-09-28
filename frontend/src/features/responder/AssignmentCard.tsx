import { Link } from 'react-router';
import { AssignmentStatusBadge, SeverityBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import type { ResponderAssignment } from '../../types/api';
import { directionsUrl, timeAgo } from '../../utils/format';

interface AssignmentCardProps {
  assignment: ResponderAssignment;
  /** ASSIGNED → ACCEPTED */
  onAccept?: () => void;
  /** ASSIGNED or ACCEPTED → RESPONDING */
  onRespond?: () => void;
  busy?: boolean;
}

/** One assignment with the next step for the responder: accept, start responding, or open it to resolve. */
export function AssignmentCard({ assignment, onAccept, onRespond, busy = false }: AssignmentCardProps) {
  const { incident } = assignment;
  const detailsUrl = `/responder/incidents/${incident.id}`;

  return (
    <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <Link to={detailsUrl} className="text-sm font-semibold text-slate-900 hover:text-blue-700">
            {incident.title}
          </Link>
          <p className="text-xs text-slate-500">
            {incident.type.name} · {incident.referenceNo}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SeverityBadge severity={incident.severity} />
          <AssignmentStatusBadge status={assignment.status} />
        </div>
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-slate-600">{incident.description}</p>
      <p className="mt-2 text-xs text-slate-500">
        {incident.locationText ?? 'See map'} · assigned {timeAgo(assignment.assignedAt)}
      </p>
      {assignment.notes && <p className="mt-2 rounded bg-slate-50 px-2 py-1 text-xs text-slate-700">Instructions: {assignment.notes}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {assignment.status === 'ASSIGNED' && onAccept && (
          <Button size="sm" loading={busy} onClick={onAccept}>
            Accept assignment
          </Button>
        )}
        {assignment.status === 'ACCEPTED' && onRespond && (
          <Button size="sm" loading={busy} onClick={onRespond}>
            Start responding
          </Button>
        )}
        {assignment.status === 'RESPONDING' && (
          <Link
            to={detailsUrl}
            className="inline-flex items-center rounded-md bg-blue-600 px-2.5 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Update or resolve
          </Link>
        )}
        <a
          href={directionsUrl(incident.latitude, incident.longitude)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
        >
          Directions
        </a>
        <Link to={detailsUrl} className="inline-flex items-center rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100">
          Details →
        </Link>
      </div>
    </div>
  );
}
