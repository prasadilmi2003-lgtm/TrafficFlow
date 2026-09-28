import { useState } from 'react';
import { errorMessage } from '../../api/client';
import { respondersApi } from '../../api/endpoints';
import { Alert, EmptyState, PageHeader } from '../../components/ui/Layout';
import { LoadingBlock } from '../../components/ui/Spinner';
import { POLL_INTERVAL_MS } from '../../config';
import { useAsync } from '../../hooks/useAsync';
import { AssignmentCard } from './AssignmentCard';
import { useAssignmentActions } from './useAssignmentActions';

/** Every assignment of the responder: the active ones to work on, and the finished ones. */
export function AssignmentsPage() {
  const [scope, setScope] = useState<'active' | 'history'>('active');
  const assignments = useAsync(() => respondersApi.assignments(scope), [scope], { pollMs: POLL_INTERVAL_MS });
  const actions = useAssignmentActions(() => assignments.reload());

  return (
    <>
      <PageHeader
        title="My assignments"
        description="Accept new assignments, start responding, then open an incident to add notes or resolve it."
      />

      {actions.error && (
        <div className="mb-4">
          <Alert>{actions.error}</Alert>
        </div>
      )}

      <div className="mb-4 inline-flex gap-1 rounded-lg bg-slate-100 p-1" role="tablist">
        {(['active', 'history'] as const).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={scope === key}
            onClick={() => setScope(key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${scope === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            {key === 'active' ? 'Active' : 'Finished'}
          </button>
        ))}
      </div>

      {assignments.error ? (
        <Alert>{errorMessage(assignments.error)}</Alert>
      ) : assignments.loading || !assignments.data ? (
        <LoadingBlock />
      ) : assignments.data.length === 0 ? (
        <EmptyState
          title={scope === 'active' ? 'No active assignments' : 'No finished assignments yet'}
          description={scope === 'active' ? 'When an operator sends you to an incident, it appears here.' : undefined}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {assignments.data.map((assignment) => (
            <AssignmentCard
              key={assignment.id}
              assignment={assignment}
              busy={actions.busyId === assignment.id}
              onAccept={() => actions.accept(assignment.id)}
              onRespond={() => actions.respond(assignment.id)}
            />
          ))}
        </div>
      )}
    </>
  );
}
