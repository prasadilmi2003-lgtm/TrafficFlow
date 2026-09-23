import { useState, type FormEvent } from 'react';
import { errorMessage, fieldErrors } from '../../api/client';
import { incidentTypesApi } from '../../api/endpoints';
import { ActiveBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { TextInput } from '../../components/ui/Field';
import { Alert, Card, PageHeader } from '../../components/ui/Layout';
import { LoadingBlock } from '../../components/ui/Spinner';
import { useAsync } from '../../hooks/useAsync';
import type { IncidentType } from '../../types/api';

/**
 * Incident types citizens can choose from. Types are deactivated rather than
 * deleted, because existing incidents refer to them.
 */
export function IncidentTypesPage() {
  const types = useAsync(() => incidentTypesApi.listAll(), []);
  const [form, setForm] = useState({ code: '', name: '', description: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function create(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    setError(null);
    try {
      await incidentTypesApi.create({ code: form.code, name: form.name, description: form.description || undefined });
      setForm({ code: '', name: '', description: '' });
      await types.reload();
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function toggle(type: IncidentType) {
    setBusyId(type.id);
    setError(null);
    try {
      await incidentTypesApi.update(type.id, { isActive: !type.isActive });
      await types.reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader title="Incident types" description="The choices citizens see when they report an incident." />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {error && (
            <div className="mb-4">
              <Alert>{error}</Alert>
            </div>
          )}
          {types.error ? (
            <Alert>{errorMessage(types.error)}</Alert>
          ) : types.loading || !types.data ? (
            <LoadingBlock />
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
                  <div className="flex items-center gap-2">
                    <ActiveBadge active={type.isActive} />
                    <Button variant="ghost" size="sm" loading={busyId === type.id} onClick={() => toggle(type)}>
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
            <Button type="submit" loading={saving}>
              Add incident type
            </Button>
          </form>
        </Card>
      </div>
    </>
  );
}
