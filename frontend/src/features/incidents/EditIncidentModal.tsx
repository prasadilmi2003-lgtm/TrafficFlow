import { useState } from 'react';
import { errorMessage, fieldErrors } from '../../api/client';
import { incidentsApi, incidentTypesApi, type UpdateIncidentInput } from '../../api/endpoints';
import { Button } from '../../components/ui/Button';
import { SelectInput, TextArea, TextInput } from '../../components/ui/Field';
import { Alert } from '../../components/ui/Layout';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { useAsync } from '../../hooks/useAsync';
import { SEVERITIES, type IncidentDetail, type Severity } from '../../types/api';
import { formatCoordinates } from '../../utils/format';
import { SEVERITY_LABELS } from '../../utils/labels';
import { LocationPicker, type PickedLocation } from './maps';

interface EditIncidentModalProps {
  incident: IncidentDetail;
  open: boolean;
  onClose: () => void;
  onSaved: (incident: IncidentDetail) => void;
  /** Citizens give an estimate; operators set the severity itself */
  severityLabel?: string;
  /** Label the empty severity choice "Not sure" (citizens) instead of "Choose…" */
  allowNoSeverity?: boolean;
}

/**
 * Corrects an incident's details (PATCH /incidents/:id). Only the fields that
 * changed are sent; the backend notes the change in the incident's timeline.
 * Open it with a `key` per incident so the form starts from current values.
 */
export function EditIncidentModal({
  incident,
  open,
  onClose,
  onSaved,
  severityLabel = 'Severity',
  allowNoSeverity = false,
}: EditIncidentModalProps) {
  const toast = useToast();
  const types = useAsync(() => incidentTypesApi.listActive(), []);
  const [form, setForm] = useState({
    title: incident.title,
    incidentTypeId: incident.type.id,
    severity: (incident.severity ?? '') as Severity | '',
    description: incident.description,
    locationText: incident.locationText ?? '',
  });
  const [location, setLocation] = useState<PickedLocation>({ latitude: incident.latitude, longitude: incident.longitude });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (field: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [field]: value }));

  // The current type stays selectable even if an admin has deactivated it since
  const typeOptions = types.data ?? [];
  const currentTypeListed = typeOptions.some((type) => type.id === incident.type.id);

  async function save() {
    const changes: UpdateIncidentInput = {};
    if (form.title.trim() !== incident.title) changes.title = form.title.trim();
    if (form.description.trim() !== incident.description) changes.description = form.description.trim();
    if (form.incidentTypeId !== incident.type.id) changes.incidentTypeId = form.incidentTypeId;
    if (form.severity && form.severity !== incident.severity) changes.severity = form.severity;
    if (form.locationText.trim() !== (incident.locationText ?? '')) changes.locationText = form.locationText.trim() || null;
    if (location.latitude !== incident.latitude || location.longitude !== incident.longitude) {
      changes.latitude = location.latitude;
      changes.longitude = location.longitude;
    }

    if (Object.keys(changes).length === 0) {
      toast.info('Nothing was changed.');
      onClose();
      return;
    }

    setSaving(true);
    setErrors({});
    setError(null);
    try {
      onSaved(await incidentsApi.update(incident.id, changes));
      toast.success('Incident details updated');
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
      open={open}
      size="lg"
      title={`Edit ${incident.referenceNo}`}
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
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <TextInput label="Title" value={form.title} maxLength={120} onChange={(e) => set('title')(e.target.value)} error={errors.title} />
        </div>
        <SelectInput label="Incident type" value={form.incidentTypeId} onChange={(e) => set('incidentTypeId')(e.target.value)} error={errors.incidentTypeId}>
          {!currentTypeListed && <option value={incident.type.id}>{incident.type.name}</option>}
          {typeOptions.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </SelectInput>
        <SelectInput label={severityLabel} value={form.severity} onChange={(e) => set('severity')(e.target.value)} error={errors.severity}>
          {!incident.severity && <option value="">{allowNoSeverity ? 'Not sure' : 'Choose…'}</option>}
          {SEVERITIES.map((severity) => (
            <option key={severity} value={severity}>
              {SEVERITY_LABELS[severity]}
            </option>
          ))}
        </SelectInput>
        <div className="sm:col-span-2">
          <TextArea
            label="Description"
            rows={4}
            maxLength={2000}
            value={form.description}
            onChange={(e) => set('description')(e.target.value)}
            error={errors.description}
          />
        </div>
        <div className="sm:col-span-2">
          <TextInput
            label="Street or landmark"
            optional
            maxLength={255}
            value={form.locationText}
            onChange={(e) => set('locationText')(e.target.value)}
            error={errors.locationText}
          />
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">Location on the map</p>
        <LocationPicker value={location} onChange={setLocation} recenterVersion={0} />
        <p className={`mt-2 text-sm ${errors.latitude || errors.longitude ? 'text-red-600' : 'text-slate-500'}`}>
          {errors.latitude ?? errors.longitude ?? `${formatCoordinates(location.latitude, location.longitude)}. Click the map to move it.`}
        </p>
      </div>
    </Modal>
  );
}
