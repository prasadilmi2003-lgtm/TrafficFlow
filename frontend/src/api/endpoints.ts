import type {
  Availability,
  DashboardStats,
  IncidentDetail,
  IncidentStatus,
  IncidentSummary,
  IncidentType,
  MapIncident,
  Paginated,
  Responder,
  ResponderAssignment,
  ResponderType,
  Role,
  Severity,
  SystemStats,
  User,
} from '../types/api';
import { api } from './client';

/** Arrays are sent comma-separated (?status=REPORTED,VERIFIED), which the backend accepts. */
function query(params: Record<string, unknown>): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length > 0) result[key] = value.join(',');
    } else {
      result[key] = value as string | number | boolean;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

export interface RegisterInput {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
}

export const authApi = {
  me: () => api.get<User>('/auth/me').then((r) => r.data),
  login: (email: string, password: string) => api.post<User>('/auth/login', { email, password }).then((r) => r.data),
  register: (input: RegisterInput) => api.post<User>('/auth/register', input).then((r) => r.data),
  logout: () => api.post('/auth/logout').then(() => undefined),
};

// ---------------------------------------------------------------------------
// Incidents
// ---------------------------------------------------------------------------

export interface IncidentListParams {
  page?: number;
  limit?: number;
  status?: IncidentStatus[];
  typeId?: string;
  severity?: Severity;
  search?: string;
}

export const incidentsApi = {
  listMine: (params: IncidentListParams = {}) =>
    api.get<Paginated<IncidentSummary>>('/incidents/mine', { params: query({ ...params }) }).then((r) => r.data),
  list: (params: IncidentListParams = {}) =>
    api.get<Paginated<IncidentSummary>>('/incidents', { params: query({ ...params }) }).then((r) => r.data),
  map: () => api.get<{ items: MapIncident[] }>('/incidents/map').then((r) => r.data.items),
  get: (id: string) => api.get<IncidentDetail>(`/incidents/${id}`).then((r) => r.data),
  /** Multipart form: incidentTypeId, description, latitude, longitude, locationText, image (optional) */
  create: (form: FormData) => api.post<IncidentDetail>('/incidents', form).then((r) => r.data),
  verify: (id: string, severity: Severity, note?: string) =>
    api.patch<IncidentDetail>(`/incidents/${id}/verify`, { severity, note }).then((r) => r.data),
  reject: (id: string, reason: string) =>
    api.patch<IncidentDetail>(`/incidents/${id}/reject`, { reason }).then((r) => r.data),
  assign: (id: string, responderIds: string[], notes?: string) =>
    api.post<IncidentDetail>(`/incidents/${id}/assignments`, { responderIds, notes }).then((r) => r.data),
  cancelAssignment: (id: string, assignmentId: string) =>
    api.patch<IncidentDetail>(`/incidents/${id}/assignments/${assignmentId}/cancel`).then((r) => r.data),
  resolve: (id: string, resolutionNotes: string) =>
    api.patch<IncidentDetail>(`/incidents/${id}/resolve`, { resolutionNotes }).then((r) => r.data),
  /** Used directly as <img src>: the browser sends the session cookie itself. */
  imageUrl: (id: string) => `/api/v1/incidents/${id}/image`,
};

// ---------------------------------------------------------------------------
// Incident types
// ---------------------------------------------------------------------------

export const incidentTypesApi = {
  listActive: () => api.get<{ items: IncidentType[] }>('/incident-types').then((r) => r.data.items),
  listAll: () => api.get<{ items: IncidentType[] }>('/admin/incident-types').then((r) => r.data.items),
  create: (input: { code: string; name: string; description?: string }) =>
    api.post<IncidentType>('/admin/incident-types', input).then((r) => r.data),
  update: (id: string, input: { name?: string; description?: string | null; isActive?: boolean }) =>
    api.patch<IncidentType>(`/admin/incident-types/${id}`, input).then((r) => r.data),
};

// ---------------------------------------------------------------------------
// Responders
// ---------------------------------------------------------------------------

export const respondersApi = {
  list: (params: { type?: ResponderType; availability?: Availability; includeInactive?: boolean } = {}) =>
    api.get<{ items: Responder[] }>('/responders', { params: query({ ...params }) }).then((r) => r.data.items),
  update: (id: string, input: { responderType?: ResponderType; unitCode?: string; availability?: Availability }) =>
    api.patch<Responder>(`/admin/responders/${id}`, input).then((r) => r.data),

  // The logged-in responder's own data
  me: () => api.get<Responder>('/responder/me').then((r) => r.data),
  setAvailability: (availability: 'AVAILABLE' | 'OFF_DUTY') =>
    api.patch<Responder>('/responder/me/availability', { availability }).then((r) => r.data),
  assignments: (scope: 'active' | 'history') =>
    api.get<{ items: ResponderAssignment[] }>('/responder/assignments', { params: { scope } }).then((r) => r.data.items),
  respond: (assignmentId: string) =>
    api.patch<IncidentDetail>(`/responder/assignments/${assignmentId}/respond`).then((r) => r.data),
};

// ---------------------------------------------------------------------------
// Users (admin)
// ---------------------------------------------------------------------------

export interface CreateUserInput {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
  role: Role;
  responderProfile?: { responderType: ResponderType; unitCode: string };
}

export interface UpdateUserInput {
  fullName?: string;
  phone?: string | null;
  role?: Role;
  isActive?: boolean;
  password?: string;
}

export const usersApi = {
  list: (params: { page?: number; limit?: number; role?: Role; isActive?: boolean; search?: string } = {}) =>
    api.get<Paginated<User>>('/admin/users', { params: query({ ...params }) }).then((r) => r.data),
  create: (input: CreateUserInput) => api.post<User>('/admin/users', input).then((r) => r.data),
  update: (id: string, input: UpdateUserInput) => api.patch<User>(`/admin/users/${id}`, input).then((r) => r.data),
};

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

export const statsApi = {
  dashboard: () => api.get<DashboardStats>('/stats/dashboard').then((r) => r.data),
  system: () => api.get<SystemStats>('/stats/system').then((r) => r.data),
};
