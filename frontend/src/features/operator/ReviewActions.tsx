import { useMemo, useState } from 'react';
import { errorMessage } from '../../api/client';
import { incidentsApi, respondersApi } from '../../api/endpoints';
import { AvailabilityBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { FilterSelect, SelectInput, TextArea } from '../../components/ui/Field';
import { Alert, Card } from '../../components/ui/Layout';
import { LoadingBlock } from '../../components/ui/Spinner';
import { useAsync } from '../../hooks/useAsync';
import { RESPONDER_TYPES, SEVERITIES, type IncidentDetail, type ResponderType, type Severity } from '../../types/api';
import { RESPONDER_TYPE_LABELS, SEVERITY_LABELS } from '../../utils/labels';

type OnUpdated = (incident: IncidentDetail) => void;

/** Runs an API action, showing a spinner and any error message. */
function useAction() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(name: string, action: () => Promise<void>) {
    setBusy(name);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return { busy, error, run };
}

/** REPORTED: the operator verifies the report (setting a severity) or rejects it with a reason. */
export function ReviewPanel({ incident, onUpdated }: { incident: IncidentDetail; onUpdated: OnUpdated }) {
  // Starts with the reporter's own estimate, if they gave one; the operator decides the final severity.
  const [severity, setSeverity] = useState<Severity | ''>(incident.severity ?? '');
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const { busy, error, run } = useAction();

  return (
    <Card title="Review this report">
      <div className="space-y-4">
        {error && <Alert>{error}</Alert>}
        {!rejecting ? (
          <>
            <SelectInput
              label="Severity"
              value={severity}
              onChange={(e) => setSeverity(e.target.value as Severity)}
              hint={incident.severity ? `The reporter estimated: ${SEVERITY_LABELS[incident.severity]}` : undefined}
              required
            >
              <option value="">Choose severity…</option>
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {SEVERITY_LABELS[s]}
                </option>
              ))}
            </SelectInput>
            <TextArea label="Note" optional rows={2} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={!severity}
                loading={busy === 'verify'}
                onClick={() =>
                  run('verify', async () => onUpdated(await incidentsApi.verify(incident.id, severity as Severity, note || undefined)))
                }
              >
                Verify incident
              </Button>
              <Button variant="secondary" onClick={() => setRejecting(true)}>
                Reject…
              </Button>
            </div>
          </>
        ) : (
          <>
            <TextArea
              label="Reason for rejecting"
              rows={3}
              maxLength={500}
              hint="The citizen who reported it will see this."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="danger"
                disabled={reason.trim().length < 5}
                loading={busy === 'reject'}
                onClick={() => run('reject', async () => onUpdated(await incidentsApi.reject(incident.id, reason.trim())))}
              >
                Reject report
              </Button>
              <Button variant="secondary" onClick={() => setRejecting(false)}>
                Back
              </Button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

/** VERIFIED, ASSIGNED or RESPONDING: pick one or more responders to send. */
export function AssignPanel({ incident, onUpdated }: { incident: IncidentDetail; onUpdated: OnUpdated }) {
  const [type, setType] = useState<ResponderType | ''>('');
  const [selected, setSelected] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const { busy, error, run } = useAction();
  const responders = useAsync(() => respondersApi.list({ type: type || undefined }), [type]);

  // Responders already working on this incident can't be picked again
  const alreadyAssigned = useMemo(
    () =>
      new Set(
        incident.assignments.filter((a) => a.status === 'ASSIGNED' || a.status === 'RESPONDING').map((a) => a.responder.id),
      ),
    [incident.assignments],
  );

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  }

  return (
    <Card title={incident.status === 'VERIFIED' ? 'Assign responders' : 'Add responders'}>
      <div className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <FilterSelect label="Responder type" value={type} onChange={(e) => setType(e.target.value as ResponderType | '')}>
          <option value="">All responder types</option>
          {RESPONDER_TYPES.map((t) => (
            <option key={t} value={t}>
              {RESPONDER_TYPE_LABELS[t]}
            </option>
          ))}
        </FilterSelect>

        {responders.loading ? (
          <LoadingBlock label="Loading responders…" />
        ) : responders.error ? (
          <Alert>{errorMessage(responders.error)}</Alert>
        ) : (
          <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-md ring-1 ring-slate-200">
            {responders.data?.map((responder) => {
              const unavailable = responder.availability === 'OFF_DUTY' || alreadyAssigned.has(responder.id);
              return (
                <li key={responder.id}>
                  <label className={`flex items-center gap-3 px-3 py-2 ${unavailable ? 'opacity-50' : 'cursor-pointer hover:bg-slate-50'}`}>
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-blue-600"
                      disabled={unavailable}
                      checked={selected.includes(responder.id)}
                      onChange={() => toggle(responder.id)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-slate-900">
                        {responder.unitCode} <span className="font-normal text-slate-500">· {RESPONDER_TYPE_LABELS[responder.responderType]}</span>
                      </span>
                      <span className="block text-xs text-slate-500">
                        {responder.fullName}
                        {alreadyAssigned.has(responder.id)
                          ? ' · already on this incident'
                          : responder.activeAssignments > 0
                            ? ` · ${responder.activeAssignments} active`
                            : ''}
                      </span>
                    </span>
                    <AvailabilityBadge availability={responder.availability} />
                  </label>
                </li>
              );
            })}
            {responders.data?.length === 0 && <li className="px-3 py-4 text-sm text-slate-500">No responders of this type.</li>}
          </ul>
        )}

        <TextArea label="Instructions for responders" optional rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <Button
          disabled={selected.length === 0}
          loading={busy === 'assign'}
          onClick={() =>
            run('assign', async () => {
              onUpdated(await incidentsApi.assign(incident.id, selected, notes || undefined));
              setSelected([]);
              setNotes('');
              responders.reload();
            })
          }
        >
          {selected.length > 1 ? `Assign ${selected.length} responders` : 'Assign responder'}
        </Button>
      </div>
    </Card>
  );
}

/** RESPONDING: operators may close the incident themselves, e.g. when a responder reports back by radio. */
export function OperatorResolvePanel({ incident, onUpdated }: { incident: IncidentDetail; onUpdated: OnUpdated }) {
  const [notes, setNotes] = useState('');
  const { busy, error, run } = useAction();

  return (
    <Card title="Resolve (operator override)">
      <div className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <TextArea
          label="How was it resolved?"
          rows={3}
          maxLength={1000}
          hint="Normally the responder resolves the incident. Use this when they report back another way."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <Button
          variant="secondary"
          disabled={notes.trim().length < 5}
          loading={busy === 'resolve'}
          onClick={() => run('resolve', async () => onUpdated(await incidentsApi.resolve(incident.id, notes.trim())))}
        >
          Mark as resolved
        </Button>
      </div>
    </Card>
  );
}
