import { useState, type ReactNode } from 'react';
import { incidentsApi } from '../../api/endpoints';
import { SeverityBadge, StatusBadge } from '../../components/ui/Badge';
import { Alert, Card, Detail } from '../../components/ui/Layout';
import type { Assignment, IncidentDetail } from '../../types/api';
import { formatCoordinates, formatDateTime, openStreetMapUrl, timeAgo } from '../../utils/format';
import { STATUS_DESCRIPTIONS } from '../../utils/labels';
import { AssignmentList } from './AssignmentList';
import { LocationMap } from './maps';
import { StatusTimeline } from './StatusTimeline';

interface IncidentDetailsProps {
  incident: IncidentDetail;
  /** Role-specific actions (verify, assign, respond…) shown in the side column */
  actions?: ReactNode;
  /** Per-assignment action, e.g. a cancel button for operators */
  assignmentAction?: (assignment: Assignment) => ReactNode;
  /** Show the reporter's contact details (staff and responders) */
  showReporter?: boolean;
}

/** The full picture of one incident, shared by the citizen, operator, responder and admin pages. */
export function IncidentDetails({ incident, actions, assignmentAction, showReporter = false }: IncidentDetailsProps) {
  const [photoFailed, setPhotoFailed] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{incident.referenceNo}</h1>
        <StatusBadge status={incident.status} />
        {incident.severity && <SeverityBadge severity={incident.severity} />}
      </div>
      <p className="-mt-4 text-sm text-slate-600">
        {incident.type.name} · reported {timeAgo(incident.createdAt)} · {STATUS_DESCRIPTIONS[incident.status]}
      </p>

      {incident.status === 'REJECTED' && incident.rejectionReason && (
        <Alert tone="warning" title="Report rejected">
          {incident.rejectionReason}
        </Alert>
      )}
      {incident.status === 'RESOLVED' && incident.resolutionNotes && (
        <Alert tone="success" title={`Resolved ${formatDateTime(incident.resolvedAt)}`}>
          {incident.resolutionNotes}
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Incident">
            <p className="whitespace-pre-line text-sm text-slate-800">{incident.description}</p>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <Detail label="Location">
                {incident.locationText ?? 'No description given'}
                <span className="block text-xs text-slate-500">
                  {formatCoordinates(incident.latitude, incident.longitude)} ·{' '}
                  <a
                    href={openStreetMapUrl(incident.latitude, incident.longitude)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    open map
                  </a>
                </span>
              </Detail>
              <Detail label="Reported">{formatDateTime(incident.createdAt)}</Detail>
              {showReporter && (
                <Detail label="Reported by">
                  {incident.reportedBy.fullName}
                  <span className="block text-xs text-slate-500">
                    {[incident.reportedBy.phone, incident.reportedBy.email].filter(Boolean).join(' · ')}
                  </span>
                </Detail>
              )}
              {incident.reviewedBy && (
                <Detail label="Reviewed by">
                  {incident.reviewedBy.fullName}
                  <span className="block text-xs text-slate-500">{formatDateTime(incident.reviewedAt)}</span>
                </Detail>
              )}
            </dl>
            <div className="mt-5">
              <LocationMap latitude={incident.latitude} longitude={incident.longitude} status={incident.status} />
            </div>
          </Card>

          {incident.hasImage && !photoFailed && (
            <Card title="Photo">
              <a href={incidentsApi.imageUrl(incident.id)} target="_blank" rel="noreferrer">
                <img
                  src={incidentsApi.imageUrl(incident.id)}
                  alt={`Photo of incident ${incident.referenceNo}`}
                  className="max-h-96 rounded-md object-contain"
                  onError={() => setPhotoFailed(true)}
                />
              </a>
            </Card>
          )}

          <Card title="Responders">
            <AssignmentList assignments={incident.assignments} action={assignmentAction} showContact={showReporter} />
          </Card>
        </div>

        <div className="space-y-6">
          {actions}
          <Card title="Timeline">
            <StatusTimeline history={incident.history} />
          </Card>
        </div>
      </div>
    </div>
  );
}
