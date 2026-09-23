import { useState } from 'react';
import { errorMessage, fieldErrors } from '../../api/client';
import { respondersApi } from '../../api/endpoints';
import { ActiveBadge, AvailabilityBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { SelectInput, TextInput } from '../../components/ui/Field';
import { Alert, EmptyState, PageHeader } from '../../components/ui/Layout';
import { Modal } from '../../components/ui/Modal';
import { LoadingBlock } from '../../components/ui/Spinner';
import { POLL_INTERVAL_MS } from '../../config';
import { useAsync } from '../../hooks/useAsync';
import { AVAILABILITIES, RESPONDER_TYPES, type Availability, type Responder, type ResponderType } from '../../types/api';
import { AVAILABILITY_LABELS, RESPONDER_TYPE_LABELS } from '../../utils/labels';

function EditResponderModal({ responder, onClose, onSaved }: { responder: Responder | null; onClose: () => void; onSaved: () => void }) {
  // The dialog is remounted for each responder (see `key` below), so the form starts from its current values
  const [form, setForm] = useState({
    responderType: responder?.responderType ?? ('POLICE' as ResponderType),
    unitCode: responder?.unitCode ?? '',
    availability: responder?.availability ?? ('AVAILABLE' as Availability),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!responder) return;
    const changes: { responderType?: ResponderType; unitCode?: string; availability?: Availability } = {};
    if (form.responderType !== responder.responderType) changes.responderType = form.responderType;
    if (form.unitCode.trim().toUpperCase() !== responder.unitCode) changes.unitCode = form.unitCode;
    if (form.availability !== responder.availability) changes.availability = form.availability;
    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await respondersApi.update(responder.id, changes);
      onSaved();
      onClose();
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={responder !== null}
      title={`Edit ${responder?.unitCode ?? ''}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} onClick={save}>
            Save changes
          </Button>
        </>
      }
    >
      {error && <Alert>{error}</Alert>}
      <SelectInput label="Responder type" value={form.responderType} onChange={(e) => setForm((f) => ({ ...f, responderType: e.target.value as ResponderType }))}>
        {RESPONDER_TYPES.map((type) => (
          <option key={type} value={type}>
            {RESPONDER_TYPE_LABELS[type]}
          </option>
        ))}
      </SelectInput>
      <TextInput label="Unit code" value={form.unitCode} onChange={(e) => setForm((f) => ({ ...f, unitCode: e.target.value }))} error={errors.unitCode} />
      <SelectInput
        label="Availability"
        hint="Availability changes automatically with assignments; change it here only to correct it."
        value={form.availability}
        onChange={(e) => setForm((f) => ({ ...f, availability: e.target.value as Availability }))}
      >
        {AVAILABILITIES.map((a) => (
          <option key={a} value={a}>
            {AVAILABILITY_LABELS[a]}
          </option>
        ))}
      </SelectInput>
    </Modal>
  );
}

export function RespondersPage() {
  const responders = useAsync(() => respondersApi.list({ includeInactive: true }), [], { pollMs: POLL_INTERVAL_MS });
  const [editing, setEditing] = useState<Responder | null>(null);

  return (
    <>
      <PageHeader
        title="Responders"
        description="Response units and their availability. To add a responder, create a user with the Responder role."
      />

      {responders.error ? (
        <Alert>{errorMessage(responders.error)}</Alert>
      ) : responders.loading || !responders.data ? (
        <LoadingBlock />
      ) : responders.data.length === 0 ? (
        <EmptyState title="No responders yet" description="Create a user with the Responder role on the Users page." />
      ) : (
        <div className="overflow-x-auto rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3">Unit</th>
                <th scope="col" className="px-4 py-3">Type</th>
                <th scope="col" className="px-4 py-3">Availability</th>
                <th scope="col" className="px-4 py-3 text-right">Active assignments</th>
                <th scope="col" className="px-4 py-3">Account</th>
                <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {responders.data.map((responder) => (
                <tr key={responder.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{responder.unitCode}</p>
                    <p className="text-xs text-slate-500">
                      {responder.fullName}
                      {responder.phone && ` · ${responder.phone}`}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{RESPONDER_TYPE_LABELS[responder.responderType]}</td>
                  <td className="px-4 py-3">
                    <AvailabilityBadge availability={responder.availability} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">{responder.activeAssignments}</td>
                  <td className="px-4 py-3">
                    <ActiveBadge active={responder.isActive} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(responder)}>
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <EditResponderModal key={editing?.id ?? 'closed'} responder={editing} onClose={() => setEditing(null)} onSaved={() => void responders.reload()} />
    </>
  );
}
