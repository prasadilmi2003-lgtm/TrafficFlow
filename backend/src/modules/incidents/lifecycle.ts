import type { IncidentStatus, Role } from '../../types/domain.js';
import { AppError } from '../../utils/AppError.js';

/**
 * The incident lifecycle as one table: every allowed status change and the
 * roles that may make it. Anything not listed here is refused.
 *
 *   REPORTED ──► VERIFIED ──► ASSIGNED ──► RESPONDING ──► RESOLVED
 *       │
 *       └──► REJECTED
 *
 * REJECTED and RESOLVED are final. Status never moves backwards.
 */
export const TRANSITIONS: ReadonlyArray<{ from: IncidentStatus; to: IncidentStatus; roles: readonly Role[] }> = [
  { from: 'REPORTED', to: 'VERIFIED', roles: ['OPERATOR'] },
  { from: 'REPORTED', to: 'REJECTED', roles: ['OPERATOR'] },
  { from: 'VERIFIED', to: 'ASSIGNED', roles: ['OPERATOR'] },
  { from: 'ASSIGNED', to: 'RESPONDING', roles: ['RESPONDER'] },
  // Operators may resolve as an override, e.g. when a responder reports back by radio
  { from: 'RESPONDING', to: 'RESOLVED', roles: ['RESPONDER', 'OPERATOR'] },
];

export const FINAL_STATUSES: readonly IncidentStatus[] = ['REJECTED', 'RESOLVED'];

/** Statuses in which responders can be (or still be) assigned */
export const ASSIGNABLE_STATUSES: readonly IncidentStatus[] = ['VERIFIED', 'ASSIGNED', 'RESPONDING'];

/** Statuses that can follow `from`, whoever makes the change. */
export function nextStatuses(from: IncidentStatus): IncidentStatus[] {
  return TRANSITIONS.filter((transition) => transition.from === from).map((transition) => transition.to);
}

export function canTransition(from: IncidentStatus, to: IncidentStatus, role: Role): boolean {
  return TRANSITIONS.some((t) => t.from === from && t.to === to && t.roles.includes(role));
}

/**
 * Throws unless `role` may move an incident from `from` to `to`.
 *
 * - 409 INVALID_STATUS_TRANSITION: the change isn't part of the lifecycle
 * - 403 TRANSITION_NOT_ALLOWED:    the change exists, but not for this role
 */
export function assertTransition(from: IncidentStatus, to: IncidentStatus, role: Role): void {
  const transition = TRANSITIONS.find((t) => t.from === from && t.to === to);

  if (!transition) {
    throw AppError.conflict('INVALID_STATUS_TRANSITION', `Cannot move an incident from ${from} to ${to}`, {
      from,
      to,
      allowed: nextStatuses(from),
    });
  }

  if (!transition.roles.includes(role)) {
    throw AppError.forbidden('TRANSITION_NOT_ALLOWED', `A ${role.toLowerCase()} cannot move an incident from ${from} to ${to}`);
  }
}
