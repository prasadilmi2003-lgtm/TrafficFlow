import type { AssignmentStatus, Availability, IncidentStatus, ResponderType, Role, Severity } from '../types/api';

export const STATUS_LABELS: Record<IncidentStatus, string> = {
  REPORTED: 'Reported',
  VERIFIED: 'Verified',
  REJECTED: 'Rejected',
  ASSIGNED: 'Assigned',
  RESPONDING: 'Responding',
  RESOLVED: 'Resolved',
};

/** What each status means, in words a citizen understands. */
export const STATUS_DESCRIPTIONS: Record<IncidentStatus, string> = {
  REPORTED: 'Waiting for an operator to review the report',
  VERIFIED: 'Confirmed by an operator; responders are being arranged',
  REJECTED: 'Closed by an operator after review',
  ASSIGNED: 'Responders have been assigned',
  RESPONDING: 'Responders are on their way or at the scene',
  RESOLVED: 'The incident has been dealt with',
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
};

export const ROLE_LABELS: Record<Role, string> = {
  CITIZEN: 'Citizen',
  OPERATOR: 'Operator',
  RESPONDER: 'Responder',
  ADMIN: 'Admin',
};

export const RESPONDER_TYPE_LABELS: Record<ResponderType, string> = {
  POLICE: 'Police',
  AMBULANCE: 'Ambulance',
  FIRE: 'Fire service',
  TOW: 'Tow truck',
  ROAD_MAINTENANCE: 'Road maintenance',
};

export const AVAILABILITY_LABELS: Record<Availability, string> = {
  AVAILABLE: 'Available',
  BUSY: 'Busy',
  OFF_DUTY: 'Off duty',
};

export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
  ASSIGNED: 'Assigned',
  RESPONDING: 'Responding',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

/** Map marker colours per status (same hues as the status badges). */
export const STATUS_MARKER_COLORS: Record<IncidentStatus, string> = {
  REPORTED: '#d97706',
  VERIFIED: '#0284c7',
  ASSIGNED: '#7c3aed',
  RESPONDING: '#ea580c',
  RESOLVED: '#059669',
  REJECTED: '#64748b',
};

/** The page each role lands on after logging in. */
export function homePathForRole(role: Role): string {
  switch (role) {
    case 'CITIZEN':
      return '/citizen';
    case 'OPERATOR':
      return '/operator';
    case 'RESPONDER':
      return '/responder';
    case 'ADMIN':
      return '/admin';
  }
}
