import { useState, type FormEvent } from 'react';
import { errorMessage } from '../../api/client';
import { incidentsApi } from '../../api/endpoints';
import { Button } from '../../components/ui/Button';
import { TextArea } from '../../components/ui/Field';
import { Alert, Card } from '../../components/ui/Layout';
import type { IncidentDetail } from '../../types/api';

/**
 * Adds a note to an open incident (POST /incidents/:id/notes) without
 * changing its status. Used by operators and by responders on their
 * assigned incidents. Notes appear in the timeline, which the citizen who
 * reported the incident also sees.
 */
export function AddNoteForm({ incidentId, onAdded }: { incidentId: string; onAdded: (incident: IncidentDetail) => void }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      onAdded(await incidentsApi.addNote(incidentId, note.trim()));
      setNote('');
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Add a note">
      <form onSubmit={onSubmit} className="space-y-3" noValidate>
        {error && <Alert>{error}</Alert>}
        {saved && <Alert tone="success">Note added to the timeline.</Alert>}
        <TextArea
          label="Note"
          rows={2}
          maxLength={1000}
          hint="For example: arrived on scene, one lane closed. The citizen who reported it can see notes."
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setSaved(false);
          }}
        />
        <Button type="submit" variant="secondary" className="w-full" disabled={note.trim().length < 2} loading={busy}>
          Add note
        </Button>
      </form>
    </Card>
  );
}
