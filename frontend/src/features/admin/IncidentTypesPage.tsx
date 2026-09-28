import { useState, type FormEvent } from 'react';
import { errorMessage, fieldErrors } from '../../api/client';
import { incidentTypesApi } from '../../api/endpoints';
import { ActiveBadge, SeverityBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { SelectInput, TextInput } from '../../components/ui/Field';
import { Alert, Card, EmptyState, PageHeader } from '../../components/ui/Layout';
import { Modal } from '../../components/ui/Modal';
import { LoadingBlock } from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/Toast';
import { useAsync } from '../../hooks/useAsync';
import { SEVERITIES, type IncidentType, type Severity } from '../../types/api';
import { SEVERITY_LABELS } from '../../utils/labels';

function SeveritySelect({ value, onChange, error }: { value: Severity | ''; onChange: (value: Severity | '') => void; error?: string }) {
  return (
    <SelectInput
      label="Default severity"
      optional
      hint="Operators start from this when they verify a report of this type."
      value={value}
      onChange={(e) => onChange(e.target.value as Severity | '')}
      error={error}
    >
      <option value="">No default</option>
      {SEVERITIES.map((severity) => (
        <option key={severity} value={severity}>
          {SEVERITY_LABELS[severity]}
        </option>
      ))}
    </SelectInput>
  );
}

/** Rename a type or change its description and default severity. The code never changes. */
function EditTypeModal({ type, onClose, onSaved }: { type: IncidentType; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: type.name,
    description: type.description ?? '',
    defaultSeverity: (type.defaultSeverity ?? '') as Severity | '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  async function save() {
    setSaving(true);
    setErrors({});
    setError(null);
    try {
      await incidentTypesApi.update(type.id, {
        name: form.name,
        description: form.description.trim() || null,
        defaultSeverity: form.defaultSeverity || null,
      });
      toast.success(`${form.name} was updated`);
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
      open
      title={`Edit ${type.name}`}
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
      <TextInput label="Code" value={type.code} disabled hint="Codes can't be changed, because reports refer to them." />
      <TextInput label="Name" value={form.name} maxLength={60} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} error={errors.name} />
      <TextInput
        label="Description"
        optional
        maxLength={500}
        value={form.description}
        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        error={errors.description}
      />
      <SeveritySelect value={form.defaultSeverity} onChange={(value) => setForm((f) => ({ ...f, defaultSeverity: value }))} error={errors.defaultSeverity} />
    </Modal>
  );
}

/**
 * Incident types citizens can choose from. Types are deactivated rather than
 * deleted, because existing incidents refer to them.
 */
export function IncidentTypesPage() {
  const types = useAsync(() => incidentTypesApi.listAll(), []);
  const [form, setForm] = useState({ code: '', name: '', description: '', defaultSeverity: '' as Severity | '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<IncidentType | null>(null);
  const [toggling, setToggling] = useState<IncidentType | null>(null);
  const toast = useToast();

  async function create(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    setError(null);
    try {
      const created = await incidentTypesApi.create({
        code: form.code,
        name: form.name,
        description: form.description || undefined,
        defaultSeverity: form.defaultSeverity || null,
      });
      toast.success(`${created.name} was added`);
      setForm({ code: '', name: '', description: '', defaultSeverity: '' });
      await types.reload();
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function toggle(type: IncidentType) {
    await incidentTypesApi.update(type.id, { isActive: !type.isActive });
    toast.success(type.isActive ? `${type.name} is no longer offered to citizens` : `${type.name} is offered to citizens again`);
    await types.reload();
  }

  return (
    <>
      <PageHeader title="Incident types" description="The choices citizens see when they report an incident, and their usual severity." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {types.error ? (
            <Alert>{errorMessage(types.error)}</Alert>
          ) : types.loading || !types.data ? (
            <LoadingBlock />
          ) : types.data.length === 0 ? (
            <EmptyState title="No incident types" description="Add the first one with the form." />
          ) : (
            <ul className="divide-y divide-slate-100 rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
              {types.data.map((type) => (
                <li key={type.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">
                      {type.name} <span className="font-mono text-xs font-normal text-slate-500">{type.code}</span>
                    </p>
                    {type.description && <p className="text-xs text-slate-500">{type.description}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {type.defaultSeverity ? (
                      <SeverityBadge severity={type.defaultSeverity} />
                    ) : (
                      <span className="text-xs text-slate-400">No default severity</span>
                    )}
                    <ActiveBadge active={type.isActive} />
                    <Button variant="ghost" size="sm" onClick={() => setEditing(type)}>
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setToggling(type)}>
                      {type.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Card title="Add a type">
          <form onSubmit={create} className="space-y-4" noValidate>
            {error && <Alert>{error}</Alert>}
            <TextInput
              label="Code"
              placeholder="OIL_SPILL"
              hint="Capital letters, numbers and underscores. Cannot be changed later."
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              error={errors.code}
            />
            <TextInput label="Name" placeholder="Oil spill" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} error={errors.name} />
            <TextInput
              label="Description"
              optional
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              error={errors.description}
            />
            <SeveritySelect
              value={form.defaultSeverity}
              onChange={(value) => setForm((f) => ({ ...f, defaultSeverity: value }))}
              error={errors.defaultSeverity}
            />
            <Button type="submit" loading={saving}>
              Add incident type
            </Button>
          </form>
        </Card>
      </div>

      {editing && <EditTypeModal key={editing.id} type={editing} onClose={() => setEditing(null)} onSaved={() => void types.reload()} />}

      <ConfirmDialog
        open={toggling !== null}
        title={toggling?.isActive ? `Deactivate ${toggling.name}?` : `Activate ${toggling?.name ?? ''}?`}
        confirmLabel={toggling?.isActive ? 'Deactivate' : 'Activate'}
        tone={toggling?.isActive ? 'danger' : 'primary'}
        onClose={() => setToggling(null)}
        onConfirm={() => (toggling ? toggle(toggling) : undefined)}
      >
        {toggling?.isActive
          ? 'Citizens will no longer be able to choose this type. Incidents already reported with it keep it.'
          : 'Citizens will be able to choose this type again when they report an incident.'}
      </ConfirmDialog>
    </>
  );
}
