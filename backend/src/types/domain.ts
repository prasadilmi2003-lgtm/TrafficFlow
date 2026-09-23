/**
 * Domain values shared across the backend. They match the PostgreSQL enum
 * types created in database/migrations/001_create_types_and_functions.sql.
 */

export const ROLES = ['CITIZEN', 'OPERATOR', 'RESPONDER', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const INCIDENT_STATUSES = [
  'REPORTED',
  'VERIFIED',
  'REJECTED',
  'ASSIGNED',
  'RESPONDING',
  'RESOLVED',
] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

/** Incidents that still need attention */
export const OPEN_INCIDENT_STATUSES = ['REPORTED', 'VERIFIED', 'ASSIGNED', 'RESPONDING'] as const satisfies readonly IncidentStatus[];

export const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type Severity = (typeof SEVERITIES)[number];

export const ASSIGNMENT_STATUSES = ['ASSIGNED', 'RESPONDING', 'COMPLETED', 'CANCELLED'] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

/** Assignments where the responder is still involved */
export const ACTIVE_ASSIGNMENT_STATUSES = ['ASSIGNED', 'RESPONDING'] as const satisfies readonly AssignmentStatus[];

export const RESPONDER_TYPES = ['POLICE', 'AMBULANCE', 'FIRE', 'TOW', 'ROAD_MAINTENANCE'] as const;
export type ResponderType = (typeof RESPONDER_TYPES)[number];

export const AVAILABILITIES = ['AVAILABLE', 'BUSY', 'OFF_DUTY'] as const;
export type Availability = (typeof AVAILABILITIES)[number];

/** The logged-in user, attached to each authenticated request as req.user */
export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: Role;
}

/** Standard shape of paginated list responses */
export interface Paginated<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
