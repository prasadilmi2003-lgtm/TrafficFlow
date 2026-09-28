import { useState } from 'react';
import { useLocation, useParams } from 'react-router';
import { errorMessage } from '../../api/client';
import { incidentsApi } from '../../api/endpoints';
import { Button, ButtonLink } from '../../components/ui/Button';
import { PencilIcon } from '../../components/ui/icons';
import { Alert } from '../../components/ui/Layout';
import { LoadingBlock } from '../../components/ui/Spinner';
import { POLL_INTERVAL_MS } from '../../config';
import { useAsync } from '../../hooks/useAsync';
import { EditIncidentModal } from '../incidents/EditIncidentModal';
import { IncidentDetails } from '../incidents/IncidentDetails';

/**
 * One of the citizen's own reports: its status, timeline and responders.
 * Until an operator reviews it, the citizen can still correct the details.
 */
export function CitizenIncidentPage() {
  const { id = '' } = useParams();
  const location = useLocation();
  const justReported = (location.state as { justReported?: boolean } | null)?.justReported;
  const { data, error, loading, setData } = useAsync(() => incidentsApi.get(id), [id], { pollMs: POLL_INTERVAL_MS });
  const [editing, setEditing] = useState(false);

  return (
    <div className="space-y-6">
      <ButtonLink to="/citizen/incidents" variant="ghost" size="sm">
        ← My reports
      </ButtonLink>
      {justReported && (
        <Alert tone="success" title="Thank you, your report has been sent">
          An operator will review it shortly. This page updates automatically as the response progresses.
        </Alert>
      )}
      {error ? (
        <Alert>{errorMessage(error)}</Alert>
      ) : loading || !data ? (
        <LoadingBlock />
      ) : (
        <>
          <IncidentDetails
            incident={data}
            headerActions={
              data.status === 'REPORTED' ? (
                <Button variant="secondary" onClick={() => setEditing(true)}>
                  <PencilIcon />
                  Edit report
                </Button>
              ) : undefined
            }
          />
          {editing && (
            <EditIncidentModal
              key={data.id}
              incident={data}
              open
              severityLabel="How serious is it?"
              allowNoSeverity
              onClose={() => setEditing(false)}
              onSaved={setData}
            />
          )}
        </>
      )}
    </div>
  );
}
