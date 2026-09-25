/**
 * Types for the data the backend API returns. They mirror the backend's
 * response shapes (backend/src/modules/*); dates arrive as ISO strings.
 */

export type Role = 'CITIZEN' | 'OPERATOR' | 'RESPONDER' | 'ADMIN';
export type IncidentStatus = 'REPORTED' | 'VERIFIED' | 'REJECTED' | 'ASSIGNED' | 'RESPONDING' | 'RESOLVED';
export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AssignmentStatus = 'ASSIGNED' | 'RESPONDING' | 'COMPLETED' | 'CANCELLED';
export type ResponderType = 'POLICE' | 'AMBULANCE' | 'FIRE' | 'TOW' | 'ROAD_MAINTENANCE';
export type Availability = 'AVAILABLE' | 'BUSY' | 'OFF_DUTY';

export const INCIDENT_STATUSES: IncidentStatus[] = ['REPORTED', 'VERIFIED', 'ASSIGNED', 'RESPONDING', 'RESOLVED', 'REJECTED'];
export const OPEN_STATUSES: IncidentStatus[] = ['REPORTED', 'VERIFIED', 'ASSIGNED', 'RESPONDING'];
export const SEVERITIES: Severity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
export const ROLES: Role[] = ['CITIZEN', 'OPERATOR', 'RESPONDER', 'ADMIN'];
export const RESPONDER_TYPES: ResponderType[] = ['POLICE', 'AMBULANCE', 'FIRE', 'TOW', 'ROAD_MAINTENANCE'];
export const AVAILABILITIES: Availability[] = ['AVAILABLE', 'BUSY', 'OFF_DUTY'];

export interface ResponderProfile {
  responderType: ResponderType;
  unitCode: string;
  availability: Availability;
}

export interface User {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: Role;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  responderProfile: ResponderProfile | null;
}

export interface IncidentType {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

export interface IncidentSummary {
  id: string;
  referenceNo: string;
  status: IncidentStatus;
  severity: Severity | null;
  description: string;
  latitude: number;
  longitude: number;
  locationText: string | null;
  hasImage: boolean;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  type: { id: string; code: string; name: string };
  reportedBy: { id: string; fullName: string };
  activeAssignments: number;
}

export interface Assignment {
  id: string;
  status: AssignmentStatus;
  notes: string | null;
  assignedAt: string;
  respondingAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  responder: {
    id: string;
    fullName: string;
    phone: string | null;
    responderType: ResponderType | null;
    unitCode: string | null;
  };
  assignedBy: { id: string; fullName: string };
}

export interface HistoryEntry {
  id: string;
  fromStatus: IncidentStatus | null;
  toStatus: IncidentStatus;
  note: string | null;
  createdAt: string;
  changedBy: { id: string; fullName: string; role: Role };
}

export interface IncidentDetail extends Omit<IncidentSummary, 'reportedBy'> {
  reportedBy: { id: string; fullName: string; email: string; phone: string | null };
  reviewedBy: { id: string; fullName: string } | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  resolutionNotes: string | null;
  assignments: Assignment[];
  history: HistoryEntry[];
}

export interface MapIncident {
  id: string;
  referenceNo: string;
  status: IncidentStatus;
  severity: Severity | null;
  latitude: number;
  longitude: number;
  locationText: string | null;
  createdAt: string;
  type: { code: string; name: string };
}

export interface Responder {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  responderType: ResponderType;
  unitCode: string;
  availability: Availability;
  activeAssignments: number;
}

export interface ResponderAssignment {
  id: string;
  status: AssignmentStatus;
  notes: string | null;
  assignedAt: string;
  respondingAt: string | null;
  completedAt: string | null;
  incident: {
    id: string;
    referenceNo: string;
    status: IncidentStatus;
    severity: Severity | null;
    description: string;
    latitude: number;
    longitude: number;
    locationText: string | null;
    createdAt: string;
    type: { code: string; name: string };
  };
}

export interface Paginated<T> {
  items: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface DashboardStats {
  openIncidents: number;
  reportedLast24h: number;
  resolvedLast24h: number;
  averageResolutionMinutes: number | null;
  incidentsByStatus: Record<IncidentStatus, number>;
  openIncidentsBySeverity: Record<Severity, number>;
  incidentsByTypeLast30Days: Array<{ code: string; name: string; count: number }>;
  last7Days: Array<{ date: string; reported: number; resolved: number }>;
  respondersByAvailability: Record<Availability, number>;
}

export interface SystemStats {
  users: { total: number; active: number; inactive: number; byRole: Record<Role, number> };
  incidents: { total: number; last30Days: number; byStatus: Record<IncidentStatus, number> };
  assignments: { total: number; active: number };
  incidentTypes: { active: number; inactive: number };
  service: { version: string; nodeVersion: string; uptimeSeconds: number };
}

/** Every error response from the API has this shape. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
    requestId?: string;
  };
}
