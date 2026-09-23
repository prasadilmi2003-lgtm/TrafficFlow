import type { ReactNode } from 'react';
import { AssignmentStatusBadge } from '../../components/ui/Badge';
import type { Assignment } from '../../types/api';
import { timeAgo } from '../../utils/format';
import { RESPONDER_TYPE_LABELS } from '../../utils/labels';

/** Responders assigned to an incident, with an optional action per row (e.g. cancel). */
export function AssignmentList({
  assignments,
  action,
  showContact = false,
}: {
  assignments: Assignment[];
  action?: (assignment: Assignment) => ReactNode;
  showContact?: boolean;
}) {
  if (assignments.length === 0) {
    return <p className="text-sm text-slate-500">No responders assigned yet.</p>;
  }

  return (
    <ul className="divide-y divide-slate-100">
      {assignments.map((assignment) => {
        const { responder } = assignment;
        const when =
          assignment.status === 'RESPONDING' && assignment.respondingAt
            ? `responding since ${timeAgo(assignment.respondingAt)}`
            : `assigned ${timeAgo(assignment.assignedAt)}`;
        return (
          <li key={assignment.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900">
                {responder.unitCode ?? 'Unit'}{' '}
                <span className="font-normal text-slate-500">
                  · {responder.responderType ? RESPONDER_TYPE_LABELS[responder.responderType] : 'Responder'}
                </span>
              </p>
              <p className="text-xs text-slate-500">
                {responder.fullName}
                {showContact && responder.phone ? ` · ${responder.phone}` : ''} · {when}
              </p>
              {assignment.notes && <p className="mt-1 text-xs text-slate-600">“{assignment.notes}”</p>}
            </div>
            <div className="flex items-center gap-2">
              <AssignmentStatusBadge status={assignment.status} />
              {action?.(assignment)}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
