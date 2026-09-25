import { useState } from 'react';
import { useParams } from 'react-router';
import { errorMessage } from '../../api/client';
import { incidentsApi } from '../../api/endpoints';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Layout';
import { Modal } from '../../components/ui/Modal';
import { LoadingBlock } from '../../components/ui/Spinner';
import { POLL_INTERVAL_MS } from '../../config';
import { useAsync } from '../../hooks/useAsync';
import type { Assignment } from '../../types/api';
import { useCurrentUser } from '../auth/useAuth';
import { AddNoteForm } from '../incidents/AddNoteForm';
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
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);

  const canAct = user.role === 'OPERATOR';
  const data = incident.data;

  async function confirmCancel() {
    if (!cancelling || !data) return;
    setCancelBusy(true);
    setCancelError(null);
    try {
      incident.setData(await incidentsApi.cancelAssignment(data.id, cancelling.id));
      setCancelling(null);
    } catch (err) {
      setCancelError(errorMessage(err));
    } finally {
      setCancelBusy(false);
    }
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
          assignmentAction={
            canAct
              ? (assignment) =>
                  assignment.status === 'ASSIGNED' ? (
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

      <Modal
        open={cancelling !== null}
        title="Cancel this assignment?"
        onClose={() => setCancelling(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelling(null)}>
              Keep it
            </Button>
            <Button variant="danger" loading={cancelBusy} onClick={confirmCancel}>
              Cancel assignment
            </Button>
          </>
        }
      >
        {cancelError && <Alert>{cancelError}</Alert>}
        <p className="text-sm text-slate-600">
          {cancelling?.responder.unitCode} will be taken off this incident and become available again. The last responder on
          an incident can&apos;t be cancelled: assign a replacement first.
        </p>
      </Modal>
    </div>
  );
}
