import { useState } from 'react';
import { errorMessage } from '../../api/client';
import { respondersApi } from '../../api/endpoints';
import { useToast } from '../../components/ui/Toast';
import type { IncidentDetail } from '../../types/api';

/**
 * Accept and start-responding actions for the responder's pages: tracks which
 * assignment is busy, shows a notification, and reports errors.
 */
export function useAssignmentActions(onDone: (incident: IncidentDetail) => void | Promise<unknown>) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  async function run(assignmentId: string, action: () => Promise<IncidentDetail>, message: (incident: IncidentDetail) => string) {
    setBusyId(assignmentId);
    setError(null);
    try {
      const incident = await action();
      toast.success(message(incident));
      await onDone(incident);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return {
    busyId,
    error,
    accept: (assignmentId: string) =>
      run(assignmentId, () => respondersApi.accept(assignmentId), (incident) => `Assignment for ${incident.referenceNo} accepted`),
    respond: (assignmentId: string) =>
      run(
        assignmentId,
        () => respondersApi.respond(assignmentId),
        (incident) => `You are responding to ${incident.referenceNo}. Drive safely.`,
      ),
  };
}
