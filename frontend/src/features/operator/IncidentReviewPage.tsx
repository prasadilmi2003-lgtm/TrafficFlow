import { useState } from 'react';
import { useParams } from 'react-router';
import { errorMessage } from '../../api/client';
import { incidentsApi } from '../../api/endpoints';
import { Button, ButtonLink } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { PencilIcon } from '../../components/ui/icons';
import { Alert } from '../../components/ui/Layout';
import { LoadingBlock } from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/Toast';
import { POLL_INTERVAL_MS } from '../../config';
import { useAsync } from '../../hooks/useAsync';
import type { Assignment } from '../../types/api';
import { useCurrentUser } from '../auth/useAuth';
import { AddNoteForm } from '../incidents/AddNoteForm';
import { EditIncidentModal } from '../incidents/EditIncidentModal';
import { IncidentDetails } from '../incidents/IncidentDetails';
import { AssignPanel, OperatorResolvePanel, ReviewPanel } from './ReviewActions';

/**
 * One incident, with the actions that fit its status. Operators can act;
 * admins (/admin/incidents/:id) see the same page read-only, because the
 * backend only lets operators change incidents.
 */
export function IncidentReviewPage({ basePath }: { basePath: string }) {
  const { id = '' } = useParams();
  const user = useCurrentUser();
  const incident = useAsync(() => incidentsApi.get(id), [id], { pollMs: POLL_INTERVAL_MS });
  const [cancelling, setCancelling] = useState<Assignment | null>(null);
  const [editing, setEditing] = useState(false);
  const toast = useToast();

  const canAct = user.role === 'OPERATOR';
  const data = incident.data;
  const isOpen = data !== undefined && data.status !== 'RESOLVED' && data.status !== 'REJECTED';

  async function confirmCancel() {
    if (!cancelling || !data) return;
    incident.setData(await incidentsApi.cancelAssignment(data.id, cancelling.id));
    toast.success(`${cancelling.responder.unitCode ?? 'The responder'} was taken off the incident`);
  }

  return (
    <div className="space-y-6">
      <ButtonLink to={`${basePath}/incidents`} variant="ghost" size="sm">
        ← All incidents
      </ButtonLink>

      {incident.error ? (
        <Alert>{errorMessage(incident.error)}</Alert>
      ) : incident.loading || !data ? (
        <LoadingBlock />
      ) : (
        <IncidentDetails
          incident={data}
          showReporter
          headerActions={
            canAct && isOpen ? (
              <Button variant="secondary" onClick={() => setEditing(true)}>
                <PencilIcon />
                Edit details
              </Button>
            ) : undefined
          }
          assignmentAction={
            canAct
              ? (assignment) =>
                  assignment.status === 'ASSIGNED' || assignment.status === 'ACCEPTED' ? (
                    <Button variant="ghost" size="sm" onClick={() => setCancelling(assignment)}>
                      Cancel
                    </Button>
                  ) : null
              : undefined
          }
          actions={
            canAct ? (
              <>
                {data.status === 'REPORTED' && <ReviewPanel incident={data} onUpdated={incident.setData} />}
                {(data.status === 'VERIFIED' || data.status === 'ASSIGNED' || data.status === 'RESPONDING') && (
                  <AssignPanel incident={data} onUpdated={incident.setData} />
                )}
                {data.status === 'RESPONDING' && <OperatorResolvePanel incident={data} onUpdated={incident.setData} />}
                {data.status !== 'RESOLVED' && data.status !== 'REJECTED' && (
                  <AddNoteForm incidentId={data.id} onAdded={incident.setData} />
                )}
              </>
            ) : (
              <Alert tone="info">Admins can view incidents. Operators handle verification and assignment.</Alert>
            )
          }
        />
      )}

      <ConfirmDialog
        open={cancelling !== null}
        title="Cancel this assignment?"
        confirmLabel="Cancel assignment"
        cancelLabel="Keep it"
        tone="danger"
        onConfirm={confirmCancel}
        onClose={() => setCancelling(null)}
      >
        {cancelling?.responder.unitCode} will be taken off this incident and become available again. The last responder on an
        incident can&apos;t be cancelled: assign a replacement first.
      </ConfirmDialog>

      {editing && data && (
        <EditIncidentModal key={data.id} incident={data} open onClose={() => setEditing(false)} onSaved={incident.setData} />
      )}
    </div>
  );
}
