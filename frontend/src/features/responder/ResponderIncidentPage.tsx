import { useState } from 'react';
import { useParams } from 'react-router';
import { errorMessage } from '../../api/client';
import { incidentsApi } from '../../api/endpoints';
import { Button, ButtonLink } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { TextArea } from '../../components/ui/Field';
import { Alert, Card } from '../../components/ui/Layout';
import { LoadingBlock } from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/Toast';
import { POLL_INTERVAL_MS } from '../../config';
import { useAsync } from '../../hooks/useAsync';
import type { Assignment, IncidentDetail } from '../../types/api';
import { directionsUrl, formatDateTime } from '../../utils/format';
import { useCurrentUser } from '../auth/useAuth';
import { AddNoteForm } from '../incidents/AddNoteForm';
import { IncidentDetails } from '../incidents/IncidentDetails';
import { useAssignmentActions } from './useAssignmentActions';

const STEPS = [
  { key: 'ASSIGNED', label: 'Assigned' },
  { key: 'ACCEPTED', label: 'Accepted' },
  { key: 'RESPONDING', label: 'Responding' },
  { key: 'RESOLVED', label: 'Resolved' },
] as const;

/** Where the responder is in their response: 0 = assigned … 3 = resolved. */
function currentStep(assignment: Assignment | undefined, incident: IncidentDetail): number {
  if (incident.status === 'RESOLVED' || assignment?.status === 'COMPLETED') return 3;
  if (assignment?.status === 'RESPONDING') return 2;
  if (assignment?.status === 'ACCEPTED') return 1;
  return 0;
}

function ResponseSteps({ step }: { step: number }) {
  return (
    <ol className="grid grid-cols-4 gap-1" aria-label="Your response">
      {STEPS.map((s, index) => {
        const done = index < step;
        const current = index === step;
        return (
          <li key={s.key} className="text-center" aria-current={current ? 'step' : undefined}>
            <span
              className={`mx-auto block h-1.5 rounded-full ${done || current ? 'bg-blue-600' : 'bg-slate-200'}`}
              aria-hidden="true"
            />
            <span className={`mt-1.5 block text-[11px] font-medium ${current ? 'text-blue-700' : done ? 'text-slate-700' : 'text-slate-400'}`}>
              {s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** An incident the responder is assigned to: location, directions, and the next step of the response. */
export function ResponderIncidentPage() {
  const { id = '' } = useParams();
  const user = useCurrentUser();
  const toast = useToast();
  const incident = useAsync(() => incidentsApi.get(id), [id], { pollMs: POLL_INTERVAL_MS });
  const actions = useAssignmentActions((updated) => incident.setData(updated));
  const [notes, setNotes] = useState('');
  const [confirming, setConfirming] = useState(false);

  const data = incident.data;
  // The responder's own assignment: the open one if there is one, otherwise the latest
  const mine =
    data?.assignments.find(
      (a) => a.responder.id === user.id && (a.status === 'ASSIGNED' || a.status === 'ACCEPTED' || a.status === 'RESPONDING'),
    ) ?? data?.assignments.filter((a) => a.responder.id === user.id).at(-1);
  const isActive = mine !== undefined && ['ASSIGNED', 'ACCEPTED', 'RESPONDING'].includes(mine.status);

  const actionsPanel = data && (
    <>
      <Card title="Your response">
        <div className="space-y-4">
          <ResponseSteps step={currentStep(mine, data)} />
          {actions.error && <Alert>{actions.error}</Alert>}

          {mine?.notes && (
            <p className="rounded bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <span className="font-medium">Instructions:</span> {mine.notes}
            </p>
          )}

          {!mine && <p className="text-sm text-slate-600">You are not assigned to this incident.</p>}
          {mine?.status === 'CANCELLED' && <p className="text-sm text-slate-600">An operator took you off this incident.</p>}
          {mine?.status === 'COMPLETED' && (
            <p className="text-sm text-slate-600">Completed {formatDateTime(mine.completedAt)}. Thank you.</p>
          )}

          {mine?.status === 'ASSIGNED' && (
            <>
              <p className="text-sm text-slate-600">Accept the assignment so the operators know you have seen it.</p>
              <Button className="w-full" loading={actions.busyId === mine.id} onClick={() => actions.accept(mine.id)}>
                Accept assignment
              </Button>
            </>
          )}

          {mine?.status === 'ACCEPTED' && (
            <Button className="w-full" loading={actions.busyId === mine.id} onClick={() => actions.respond(mine.id)}>
              Start responding
            </Button>
          )}

          {mine?.status === 'RESPONDING' && data.status === 'RESPONDING' && (
            <>
              <TextArea
                label="How was it resolved?"
                rows={3}
                maxLength={1000}
                hint="For example: casualties taken to hospital, vehicles removed, road open."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <Button className="w-full" disabled={notes.trim().length < 5} onClick={() => setConfirming(true)}>
                Mark incident as resolved…
              </Button>
            </>
          )}

          {isActive && (
            <a
              href={directionsUrl(data.latitude, data.longitude)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-full items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
            >
              Get directions
            </a>
          )}
        </div>
      </Card>

      {/* Notes can be added while the assignment is active */}
      {isActive && <AddNoteForm incidentId={data.id} onAdded={incident.setData} />}

      <ConfirmDialog
        open={confirming}
        title={`Resolve ${data.referenceNo}?`}
        confirmLabel="Resolve incident"
        onClose={() => setConfirming(false)}
        onConfirm={async () => {
          incident.setData(await incidentsApi.resolve(data.id, notes.trim()));
          setNotes('');
          toast.success(`${data.referenceNo} resolved. Well done.`);
        }}
      >
        This closes the incident for everyone, including the citizen who reported it, and completes the other units&apos;
        assignments too. Resolved incidents can&apos;t be reopened.
      </ConfirmDialog>
    </>
  );

  return (
    <div className="space-y-6">
      <ButtonLink to="/responder/assignments" variant="ghost" size="sm">
        ← My assignments
      </ButtonLink>
      {incident.error ? (
        <Alert>{errorMessage(incident.error)}</Alert>
      ) : incident.loading || !data ? (
        <LoadingBlock />
      ) : (
        <IncidentDetails incident={data} showReporter actions={actionsPanel} />
      )}
    </div>
  );
}
