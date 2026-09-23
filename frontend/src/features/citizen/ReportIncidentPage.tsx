import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { errorMessage, fieldErrors } from '../../api/client';
import { incidentsApi, incidentTypesApi } from '../../api/endpoints';
import { Button } from '../../components/ui/Button';
import { SelectInput, TextArea, TextInput } from '../../components/ui/Field';
import { Alert, Card, PageHeader } from '../../components/ui/Layout';
import { LoadingBlock } from '../../components/ui/Spinner';
import { MAX_PHOTO_BYTES } from '../../config';
import { useAsync } from '../../hooks/useAsync';
import { formatCoordinates } from '../../utils/format';
import { LocationPicker, roundCoordinate, type PickedLocation } from '../incidents/maps';

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function omit(errors: Record<string, string>, key: string): Record<string, string> {
  const copy = { ...errors };
  delete copy[key];
  return copy;
}

export function ReportIncidentPage() {
  const navigate = useNavigate();
  const types = useAsync(() => incidentTypesApi.listActive(), []);

  const [incidentTypeId, setIncidentTypeId] = useState('');
  const [description, setDescription] = useState('');
  const [locationText, setLocationText] = useState('');
  const [location, setLocation] = useState<PickedLocation | null>(null);
  const [recenter, setRecenter] = useState(0);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [locating, setLocating] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Free the preview image's memory when it changes or the page closes
  useEffect(() => () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
  }, [photoPreview]);

  function locateMe() {
    if (!('geolocation' in navigator)) {
      setErrors((e) => ({ ...e, location: 'Your browser cannot share its location. Click the map instead.' }));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({ latitude: roundCoordinate(position.coords.latitude), longitude: roundCoordinate(position.coords.longitude) });
        setRecenter((v) => v + 1);
        setErrors((e) => omit(e, 'location'));
        setLocating(false);
      },
      () => {
        setErrors((e) => ({ ...e, location: 'Could not get your location. Allow location access, or click the map instead.' }));
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  function onPhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setErrors((e) => omit(e, 'image'));
    if (file && !PHOTO_TYPES.includes(file.type)) {
      setErrors((e) => ({ ...e, image: 'Choose a JPEG, PNG or WebP image' }));
      event.target.value = '';
      return;
    }
    if (file && file.size > MAX_PHOTO_BYTES) {
      setErrors((e) => ({ ...e, image: `The photo is too large (maximum ${MAX_PHOTO_BYTES / 1024 / 1024} MB)` }));
      event.target.value = '';
      return;
    }
    setPhoto(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const problems: Record<string, string> = {};
    if (!incidentTypeId) problems.incidentTypeId = 'Choose what happened';
    if (description.trim().length < 10) problems.description = 'Describe the incident in at least 10 characters';
    if (!location) problems.location = 'Mark the location on the map';
    setErrors(problems);
    if (Object.keys(problems).length > 0 || !location) return;

    const form = new FormData();
    form.append('incidentTypeId', incidentTypeId);
    form.append('description', description.trim());
    form.append('latitude', String(location.latitude));
    form.append('longitude', String(location.longitude));
    if (locationText.trim()) form.append('locationText', locationText.trim());
    if (photo) form.append('image', photo);

    setSubmitting(true);
    try {
      const incident = await incidentsApi.create(form);
      navigate(`/citizen/incidents/${incident.id}`, { state: { justReported: true } });
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(errorMessage(err, 'The report could not be sent. Please try again.'));
      setSubmitting(false);
    }
  }

  if (types.loading) return <LoadingBlock />;

  return (
    <>
      <PageHeader title="Report an incident" description="Tell us what happened and where. An operator will review your report." />

      <form onSubmit={onSubmit} noValidate className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-2">
          {error && <Alert>{error}</Alert>}
          {types.error ? <Alert>{errorMessage(types.error)}</Alert> : null}

          <Card>
            <div className="space-y-4">
              <SelectInput
                label="What happened?"
                value={incidentTypeId}
                onChange={(e) => setIncidentTypeId(e.target.value)}
                error={errors.incidentTypeId}
                required
              >
                <option value="">Choose a type…</option>
                {types.data?.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </SelectInput>

              <TextArea
                label="Description"
                value={description}
                maxLength={2000}
                onChange={(e) => setDescription(e.target.value)}
                error={errors.description}
                hint={`What you saw, whether anyone is hurt, and how traffic is affected. ${description.length}/2000`}
                required
              />

              <TextInput
                label="Street or landmark"
                optional
                maxLength={255}
                placeholder="e.g. Galle Road near Kollupitiya junction"
                value={locationText}
                onChange={(e) => setLocationText(e.target.value)}
                error={errors.locationText}
              />

              <div className="space-y-1.5">
                <label htmlFor="photo" className="block text-sm font-medium text-slate-700">
                  Photo <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  id="photo"
                  type="file"
                  accept={PHOTO_TYPES.join(',')}
                  onChange={onPhotoChange}
                  className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
                />
                {errors.image ? (
                  <p className="text-sm text-red-600">{errors.image}</p>
                ) : (
                  <p className="text-sm text-slate-500">JPEG, PNG or WebP, up to {MAX_PHOTO_BYTES / 1024 / 1024} MB</p>
                )}
                {photoPreview && <img src={photoPreview} alt="Selected photo" className="mt-2 max-h-48 rounded-md" />}
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-3">
          <Card
            title="Where is it?"
            actions={
              <Button variant="secondary" size="sm" onClick={locateMe} loading={locating}>
                Use my location
              </Button>
            }
          >
            <LocationPicker value={location} onChange={setLocation} recenterVersion={recenter} />
            <p className={`mt-3 text-sm ${errors.location ? 'text-red-600' : 'text-slate-600'}`}>
              {errors.location ??
                (location
                  ? `Selected: ${formatCoordinates(location.latitude, location.longitude)}. Click the map to change it.`
                  : 'Click the map where the incident is.')}
            </p>
          </Card>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => navigate('/citizen')}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Send report
            </Button>
          </div>
        </div>
      </form>
    </>
  );
}
