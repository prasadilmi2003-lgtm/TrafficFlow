import { useState } from 'react';
import { useParams } from 'react-router';
import { errorMessage } from '../../api/client';
import { incidentsApi, respondersApi } from '../../api/endpoints';
import { Button, ButtonLink } from '../../components/ui/Button';
import { TextArea } from '../../components/ui/Field';
import { Alert, Card } from '../../components/ui/Layout';
import { LoadingBlock } from '../../components/ui/Spinner';
import { POLL_INTERVAL_MS } from '../../config';
import { useAsync } from '../../hooks/useAsync';
import type { IncidentDetail } from '../../types/api';
import { directionsUrl } from '../../utils/format';
import { useCurrentUser } from '../auth/useAuth';
import { AddNoteForm } from '../incidents/AddNoteForm';
import { IncidentDetails } from '../incidents/IncidentDetails';

/** An incident the responder is assigned to: location, directions, and the next step. */
export function ResponderIncidentPage() {
  const { id = '' } = useParams();
  const user = useCurrentUser();
  const incident = useAsync(() => incidentsApi.get(id), [id], { pollMs: POLL_INTERVAL_MS });
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const data = incident.data;
  const mine = data?.assignments.find(
    (a) => a.responder.id === user.id && (a.status === 'ASSIGNED' || a.status === 'RESPONDING'),
  );

  async function run(action: () => Promise<IncidentDetail>) {
    setBusy(true);
    setError(null);
    try {
      incident.setData(await action());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const actions = data && (
    <>
      <Card title="Your response">
        <div className="space-y-4">
          {error && <Alert>{error}</Alert>}
          <a
            href={directionsUrl(data.latitude, data.longitude)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-full items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
          >
            Get directions
          </a>

          {!mine && <p className="text-sm text-slate-600">You have no open assignment on this incident.</p>}

          {mine?.status === 'ASSIGNED' && (
            <Button className="w-full" loading={busy} onClick={() => run(() => respondersApi.respond(mine.id))}>
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
              <Button
                className="w-full"
                disabled={notes.trim().length < 5}
                loading={busy}
                onClick={() => run(() => incidentsApi.resolve(data.id, notes.trim()))}
              >
                Mark incident as resolved
              </Button>
            </>
          )}
        </div>
      </Card>

      {/* Notes can be added while the assignment is active */}
      {mine && <AddNoteForm incidentId={data.id} onAdded={incident.setData} />}
    </>
  );

  return (
    <div className="space-y-6">
      <ButtonLink to="/responder" variant="ghost" size="sm">
        ← My assignments
      </ButtonLink>
      {incident.error ? (
        <Alert>{errorMessage(incident.error)}</Alert>
      ) : incident.loading || !data ? (
        <LoadingBlock />
      ) : (
        <IncidentDetails incident={data} showReporter actions={actions} />
      )}
    </div>
  );
}
