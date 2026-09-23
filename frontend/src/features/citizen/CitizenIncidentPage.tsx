import { useLocation, useParams } from 'react-router';
import { errorMessage } from '../../api/client';
import { incidentsApi } from '../../api/endpoints';
import { ButtonLink } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Layout';
import { LoadingBlock } from '../../components/ui/Spinner';
import { POLL_INTERVAL_MS } from '../../config';
import { useAsync } from '../../hooks/useAsync';
import { IncidentDetails } from '../incidents/IncidentDetails';

export function CitizenIncidentPage() {
  const { id = '' } = useParams();
  const location = useLocation();
  const justReported = (location.state as { justReported?: boolean } | null)?.justReported;
  const { data, error, loading } = useAsync(() => incidentsApi.get(id), [id], { pollMs: POLL_INTERVAL_MS });

  return (
    <div className="space-y-6">
      <ButtonLink to="/citizen" variant="ghost" size="sm">
        ← My reports
      </ButtonLink>
      {justReported && (
        <Alert tone="success" title="Thank you, your report has been sent">
          An operator will review it shortly. This page updates automatically as the response progresses.
        </Alert>
      )}
      {error ? <Alert>{errorMessage(error)}</Alert> : loading || !data ? <LoadingBlock /> : <IncidentDetails incident={data} />}
    </div>
  );
}
