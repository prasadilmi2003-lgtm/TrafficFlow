import { useState } from 'react';
import { errorMessage } from '../../api/client';
import { respondersApi } from '../../api/endpoints';
import { AvailabilityBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Alert, Card } from '../../components/ui/Layout';
import { useToast } from '../../components/ui/Toast';
import type { Responder } from '../../types/api';
import { RESPONDER_TYPE_LABELS } from '../../utils/labels';

/** The responder's unit, vehicle and duty status, with the on/off duty switch. */
export function DutyStatusCard({ me, onChanged }: { me: Responder; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const canToggle = me.activeAssignments === 0;

  async function setAvailability(availability: 'AVAILABLE' | 'OFF_DUTY') {
    setBusy(true);
    setError(null);
    try {
      await respondersApi.setAvailability(availability);
      toast.success(availability === 'AVAILABLE' ? 'You are on duty' : 'You are off duty');
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {me.unitCode} · {RESPONDER_TYPE_LABELS[me.responderType]}
          </p>
          {(me.vehicleDescription || me.vehicleRegistration) && (
            <p className="text-xs text-slate-500">
              {[me.vehicleDescription, me.vehicleRegistration].filter(Boolean).join(' · ')}
            </p>
          )}
          <p className="mt-2 flex items-center gap-2 text-sm text-slate-600">
            Your status: <AvailabilityBadge availability={me.availability} />
          </p>
        </div>
        {canToggle ? (
          me.availability === 'OFF_DUTY' ? (
            <Button loading={busy} onClick={() => setAvailability('AVAILABLE')}>
              Go on duty
            </Button>
          ) : (
            <Button variant="secondary" loading={busy} onClick={() => setAvailability('OFF_DUTY')}>
              Go off duty
            </Button>
          )
        ) : (
          <p className="max-w-56 text-xs text-slate-500">You can go off duty after finishing your active assignments.</p>
        )}
      </div>
      {error && (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      )}
    </Card>
  );
}
