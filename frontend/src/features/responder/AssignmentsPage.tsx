import { useState } from 'react';
import { Link } from 'react-router';
import { errorMessage } from '../../api/client';
import { respondersApi } from '../../api/endpoints';
import { AssignmentStatusBadge, AvailabilityBadge, SeverityBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Alert, Card, EmptyState, PageHeader } from '../../components/ui/Layout';
import { LoadingBlock } from '../../components/ui/Spinner';
import { POLL_INTERVAL_MS } from '../../config';
import { useAsync } from '../../hooks/useAsync';
import type { ResponderAssignment } from '../../types/api';
import { directionsUrl, timeAgo } from '../../utils/format';
import { RESPONDER_TYPE_LABELS } from '../../utils/labels';

function AssignmentCard({ assignment, onRespond, busy }: { assignment: ResponderAssignment; onRespond?: () => void; busy: boolean }) {
  const { incident } = assignment;
  return (
    <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link to={`/responder/incidents/${incident.id}`} className="text-sm font-semibold text-slate-900 hover:text-blue-700">
          {incident.type.name} <span className="font-normal text-slate-500">· {incident.referenceNo}</span>
        </Link>
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
        {assignment.status === 'ASSIGNED' && onRespond && (
          <Button size="sm" loading={busy} onClick={onRespond}>
            Start responding
          </Button>
        )}
        <a
          href={directionsUrl(incident.latitude, incident.longitude)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
        >
          Directions
        </a>
        <Link
          to={`/responder/incidents/${incident.id}`}
          className="inline-flex items-center rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Details →
        </Link>
      </div>
    </div>
  );
}

export function AssignmentsPage() {
  const [scope, setScope] = useState<'active' | 'history'>('active');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const profile = useAsync(() => respondersApi.me(), [], { pollMs: POLL_INTERVAL_MS });
  const assignments = useAsync(() => respondersApi.assignments(scope), [scope], { pollMs: POLL_INTERVAL_MS });

  async function run(key: string, action: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      await action();
      await Promise.all([assignments.reload(), profile.reload()]);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const me = profile.data;
  const canToggle = me && me.activeAssignments === 0;

  return (
    <>
      <PageHeader title="My assignments" description="Incidents you have been sent to. This page updates automatically." />

      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      {me && (
        <Card className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {me.unitCode} · {RESPONDER_TYPE_LABELS[me.responderType]}
              </p>
              <p className="mt-1 flex items-center gap-2 text-sm text-slate-600">
                Your status: <AvailabilityBadge availability={me.availability} />
              </p>
            </div>
            {canToggle ? (
              me.availability === 'OFF_DUTY' ? (
                <Button loading={busy === 'duty'} onClick={() => run('duty', () => respondersApi.setAvailability('AVAILABLE'))}>
                  Go on duty
                </Button>
              ) : (
                <Button variant="secondary" loading={busy === 'duty'} onClick={() => run('duty', () => respondersApi.setAvailability('OFF_DUTY'))}>
                  Go off duty
                </Button>
              )
            ) : (
              <p className="text-xs text-slate-500">You can go off duty after finishing your active assignments.</p>
            )}
          </div>
        </Card>
      )}

      <div className="mb-4 inline-flex gap-1 rounded-lg bg-slate-100 p-1" role="tablist">
        {(['active', 'history'] as const).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={scope === key}
            onClick={() => setScope(key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${scope === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            {key === 'active' ? 'Active' : 'Finished'}
          </button>
        ))}
      </div>

      {assignments.error ? (
        <Alert>{errorMessage(assignments.error)}</Alert>
      ) : assignments.loading || !assignments.data ? (
        <LoadingBlock />
      ) : assignments.data.length === 0 ? (
        <EmptyState
          title={scope === 'active' ? 'No active assignments' : 'No finished assignments yet'}
          description={scope === 'active' ? 'When an operator sends you to an incident, it appears here.' : undefined}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {assignments.data.map((assignment) => (
            <AssignmentCard
              key={assignment.id}
              assignment={assignment}
              busy={busy === assignment.id}
              onRespond={() => run(assignment.id, () => respondersApi.respond(assignment.id))}
            />
          ))}
        </div>
      )}
    </>
  );
}
