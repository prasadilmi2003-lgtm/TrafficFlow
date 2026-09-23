import type { Queryable } from '../../db/pool.js';
import type {
  AssignmentStatus,
  Availability,
  IncidentStatus,
  ResponderType,
  Role,
  Severity,
} from '../../types/domain.js';
import { escapeLike, offsetOf, type PageRequest } from '../../utils/pagination.js';

// ---------------------------------------------------------------------------
// Types returned by the API
// ---------------------------------------------------------------------------

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
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  type: { id: string; code: string; name: string };
  reportedBy: { id: string; fullName: string };
  activeAssignments: number;
}

export interface IncidentDetail extends Omit<IncidentSummary, 'reportedBy'> {
  reportedBy: { id: string; fullName: string; email: string; phone: string | null };
  reviewedBy: { id: string; fullName: string } | null;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  resolutionNotes: string | null;
}

export interface Assignment {
  id: string;
  status: AssignmentStatus;
  notes: string | null;
  assignedAt: Date;
  respondingAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
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
  createdAt: Date;
  changedBy: { id: string; fullName: string; role: Role };
}

export interface MapIncident {
  id: string;
  referenceNo: string;
  status: IncidentStatus;
  severity: Severity | null;
  latitude: number;
  longitude: number;
  locationText: string | null;
  createdAt: Date;
  type: { code: string; name: string };
}

export interface ResponderAssignment {
  id: string;
  status: AssignmentStatus;
  notes: string | null;
  assignedAt: Date;
  respondingAt: Date | null;
  completedAt: Date | null;
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

// ---------------------------------------------------------------------------
// Reading incidents
// ---------------------------------------------------------------------------

const SUMMARY_COLUMNS = `
  i.id,
  i.reference_no AS "referenceNo",
  i.status,
  i.severity,
  i.description,
  i.latitude::float8 AS latitude,
  i.longitude::float8 AS longitude,
  i.location_text AS "locationText",
  (i.image_path IS NOT NULL) AS "hasImage",
  i.created_at AS "createdAt",
  i.updated_at AS "updatedAt",
  i.resolved_at AS "resolvedAt",
  json_build_object('id', t.id, 'code', t.code, 'name', t.name) AS type,
  (SELECT count(*)::int FROM incident_assignments a
    WHERE a.incident_id = i.id AND a.status IN ('ASSIGNED', 'RESPONDING')) AS "activeAssignments"`;

const SUMMARY_FROM = `
  FROM incidents i
  JOIN incident_types t ON t.id = i.incident_type_id
  JOIN users reporter ON reporter.id = i.reported_by`;

export interface IncidentFilters {
  statuses?: IncidentStatus[];
  typeId?: string;
  severity?: Severity;
  reportedBy?: string;
  search?: string;
  from?: Date;
  to?: Date;
}

/** Builds a WHERE clause with numbered placeholders; values are never put into the SQL text. */
function whereClause(filters: IncidentFilters): { sql: string; values: unknown[] } {
  const conditions: string[] = [];
  const values: unknown[] = [];
  const add = (condition: (placeholder: string) => string, value: unknown) => {
    values.push(value);
    conditions.push(condition(`$${values.length}`));
  };

  if (filters.statuses?.length) add((p) => `i.status = ANY(${p}::incident_status[])`, filters.statuses);
  if (filters.typeId) add((p) => `i.incident_type_id = ${p}`, filters.typeId);
  if (filters.severity) add((p) => `i.severity = ${p}`, filters.severity);
  if (filters.reportedBy) add((p) => `i.reported_by = ${p}`, filters.reportedBy);
  if (filters.from) add((p) => `i.created_at >= ${p}`, filters.from);
  if (filters.to) add((p) => `i.created_at < ${p}`, filters.to);
  if (filters.search) {
    add(
      (p) => `(i.reference_no ILIKE ${p} OR i.description ILIKE ${p} OR i.location_text ILIKE ${p})`,
      `%${escapeLike(filters.search)}%`,
    );
  }

  return { sql: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '', values };
}

export async function list(
  db: Queryable,
  filters: IncidentFilters,
  page: PageRequest,
): Promise<{ items: IncidentSummary[]; total: number }> {
  const where = whereClause(filters);
  const limitAt = where.values.length + 1;

  const [items, count] = await Promise.all([
    db.query<IncidentSummary>(
      `SELECT ${SUMMARY_COLUMNS},
              json_build_object('id', reporter.id, 'fullName', reporter.full_name) AS "reportedBy"
       ${SUMMARY_FROM}
       ${where.sql}
       ORDER BY i.created_at DESC
       LIMIT $${limitAt} OFFSET $${limitAt + 1}`,
      [...where.values, page.limit, offsetOf(page)],
    ),
    db.query<{ total: number }>(`SELECT count(*)::int AS total FROM incidents i ${where.sql}`, where.values),
  ]);

  return { items: items.rows, total: count.rows[0]?.total ?? 0 };
}

/** Open incidents for the operator map (lightweight, newest first). */
export async function listOpenForMap(db: Queryable, limit = 500): Promise<MapIncident[]> {
  const { rows } = await db.query<MapIncident>(
    `SELECT i.id,
            i.reference_no AS "referenceNo",
            i.status,
            i.severity,
            i.latitude::float8 AS latitude,
            i.longitude::float8 AS longitude,
            i.location_text AS "locationText",
            i.created_at AS "createdAt",
            json_build_object('code', t.code, 'name', t.name) AS type
     FROM incidents i
     JOIN incident_types t ON t.id = i.incident_type_id
     WHERE i.status IN ('REPORTED', 'VERIFIED', 'ASSIGNED', 'RESPONDING')
     ORDER BY i.created_at DESC
     LIMIT $1`,
    [limit],
  );
  return rows;
}

export async function findDetail(db: Queryable, id: string): Promise<IncidentDetail | null> {
  const { rows } = await db.query<IncidentDetail>(
    `SELECT ${SUMMARY_COLUMNS},
            json_build_object('id', reporter.id, 'fullName', reporter.full_name,
                              'email', reporter.email, 'phone', reporter.phone) AS "reportedBy",
            CASE WHEN reviewer.id IS NULL THEN NULL
                 ELSE json_build_object('id', reviewer.id, 'fullName', reviewer.full_name)
            END AS "reviewedBy",
            i.reviewed_at AS "reviewedAt",
            i.rejection_reason AS "rejectionReason",
            i.resolution_notes AS "resolutionNotes"
     ${SUMMARY_FROM}
     LEFT JOIN users reviewer ON reviewer.id = i.reviewed_by
     WHERE i.id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function findImagePath(db: Queryable, id: string): Promise<string | null> {
  const { rows } = await db.query<{ imagePath: string | null }>(
    'SELECT image_path AS "imagePath" FROM incidents WHERE id = $1',
    [id],
  );
  return rows[0]?.imagePath ?? null;
}

export async function listAssignments(db: Queryable, incidentId: string): Promise<Assignment[]> {
  const { rows } = await db.query<Assignment>(
    `SELECT a.id,
            a.status,
            a.notes,
            a.assigned_at AS "assignedAt",
            a.responding_at AS "respondingAt",
            a.completed_at AS "completedAt",
            a.cancelled_at AS "cancelledAt",
            json_build_object('id', r.id, 'fullName', r.full_name, 'phone', r.phone,
                              'responderType', rp.responder_type, 'unitCode', rp.unit_code) AS responder,
            json_build_object('id', op.id, 'fullName', op.full_name) AS "assignedBy"
     FROM incident_assignments a
     JOIN users r ON r.id = a.responder_id
     LEFT JOIN responder_profiles rp ON rp.user_id = r.id
     JOIN users op ON op.id = a.assigned_by
     WHERE a.incident_id = $1
     ORDER BY a.assigned_at, a.id`,
    [incidentId],
  );
  return rows;
}

export async function listHistory(db: Queryable, incidentId: string): Promise<HistoryEntry[]> {
  const { rows } = await db.query<HistoryEntry>(
    `SELECT h.id,
            h.from_status AS "fromStatus",
            h.to_status AS "toStatus",
            h.note,
            h.created_at AS "createdAt",
            json_build_object('id', u.id, 'fullName', u.full_name, 'role', u.role) AS "changedBy"
     FROM incident_status_history h
     JOIN users u ON u.id = h.changed_by
     WHERE h.incident_id = $1
     ORDER BY h.created_at, h.id`,
    [incidentId],
  );
  return rows;
}

/** True if the responder has (or had) a non-cancelled assignment on the incident. */
export async function isAssignedResponder(db: Queryable, incidentId: string, responderId: string): Promise<boolean> {
  const { rows } = await db.query<{ assigned: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM incident_assignments
       WHERE incident_id = $1 AND responder_id = $2 AND status <> 'CANCELLED'
     ) AS assigned`,
    [incidentId, responderId],
  );
  return rows[0]?.assigned ?? false;
}

export async function listForResponder(
  db: Queryable,
  responderId: string,
  statuses: readonly AssignmentStatus[],
): Promise<ResponderAssignment[]> {
  const { rows } = await db.query<ResponderAssignment>(
    `SELECT a.id,
            a.status,
            a.notes,
            a.assigned_at AS "assignedAt",
            a.responding_at AS "respondingAt",
            a.completed_at AS "completedAt",
            json_build_object(
              'id', i.id,
              'referenceNo', i.reference_no,
              'status', i.status,
              'severity', i.severity,
              'description', i.description,
              'latitude', i.latitude::float8,
              'longitude', i.longitude::float8,
              'locationText', i.location_text,
              'createdAt', i.created_at,
              'type', json_build_object('code', t.code, 'name', t.name)
            ) AS incident
     FROM incident_assignments a
     JOIN incidents i ON i.id = a.incident_id
     JOIN incident_types t ON t.id = i.incident_type_id
     WHERE a.responder_id = $1 AND a.status = ANY($2::assignment_status[])
     ORDER BY CASE a.status WHEN 'RESPONDING' THEN 0 WHEN 'ASSIGNED' THEN 1 ELSE 2 END,
              a.assigned_at DESC
     LIMIT 100`,
    [responderId, statuses],
  );
  return rows;
}

// ---------------------------------------------------------------------------
// Changing incidents (called inside transactions by the service)
// ---------------------------------------------------------------------------

export interface NewIncident {
  reportedBy: string;
  incidentTypeId: string;
  description: string;
  latitude: number;
  longitude: number;
  locationText: string | null;
  imagePath: string | null;
}

export async function insert(db: Queryable, incident: NewIncident): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO incidents (reported_by, incident_type_id, description, latitude, longitude, location_text, image_path)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      incident.reportedBy,
      incident.incidentTypeId,
      incident.description,
      incident.latitude,
      incident.longitude,
      incident.locationText,
      incident.imagePath,
    ],
  );
  return rows[0]!.id;
}

/**
 * Reads an incident's status and locks the row until the transaction ends,
 * so two operators can't change the same incident at the same moment.
 */
export async function lockForUpdate(
  db: Queryable,
  id: string,
): Promise<{ id: string; status: IncidentStatus; reportedBy: string } | null> {
  const { rows } = await db.query<{ id: string; status: IncidentStatus; reportedBy: string }>(
    'SELECT id, status, reported_by AS "reportedBy" FROM incidents WHERE id = $1 FOR UPDATE',
    [id],
  );
  return rows[0] ?? null;
}

export async function markVerified(db: Queryable, id: string, severity: Severity, reviewerId: string): Promise<void> {
  await db.query(
    `UPDATE incidents SET status = 'VERIFIED', severity = $2, reviewed_by = $3, reviewed_at = now() WHERE id = $1`,
    [id, severity, reviewerId],
  );
}

export async function markRejected(db: Queryable, id: string, reason: string, reviewerId: string): Promise<void> {
  await db.query(
    `UPDATE incidents SET status = 'REJECTED', rejection_reason = $2, reviewed_by = $3, reviewed_at = now() WHERE id = $1`,
    [id, reason, reviewerId],
  );
}

export async function setStatus(db: Queryable, id: string, status: IncidentStatus): Promise<void> {
  await db.query('UPDATE incidents SET status = $2 WHERE id = $1', [id, status]);
}

export async function markResolved(db: Queryable, id: string, resolutionNotes: string): Promise<void> {
  await db.query(
    `UPDATE incidents SET status = 'RESOLVED', resolved_at = now(), resolution_notes = $2 WHERE id = $1`,
    [id, resolutionNotes],
  );
}

export async function insertHistory(
  db: Queryable,
  entry: { incidentId: string; fromStatus: IncidentStatus | null; toStatus: IncidentStatus; changedBy: string; note: string | null },
): Promise<void> {
  await db.query(
    `INSERT INTO incident_status_history (incident_id, from_status, to_status, changed_by, note)
     VALUES ($1, $2, $3, $4, $5)`,
    [entry.incidentId, entry.fromStatus, entry.toStatus, entry.changedBy, entry.note],
  );
}

// ---------------------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------------------

export interface AssignmentRow {
  id: string;
  incidentId: string;
  responderId: string;
  status: AssignmentStatus;
}

const ASSIGNMENT_ROW = `id, incident_id AS "incidentId", responder_id AS "responderId", status`;

export async function findAssignment(db: Queryable, id: string, { lock = false } = {}): Promise<AssignmentRow | null> {
  const { rows } = await db.query<AssignmentRow>(
    `SELECT ${ASSIGNMENT_ROW} FROM incident_assignments WHERE id = $1 ${lock ? 'FOR UPDATE' : ''}`,
    [id],
  );
  return rows[0] ?? null;
}

export async function listActiveAssignments(db: Queryable, incidentId: string): Promise<AssignmentRow[]> {
  const { rows } = await db.query<AssignmentRow>(
    `SELECT ${ASSIGNMENT_ROW} FROM incident_assignments
     WHERE incident_id = $1 AND status IN ('ASSIGNED', 'RESPONDING')`,
    [incidentId],
  );
  return rows;
}

export interface ResponderCandidate {
  id: string;
  fullName: string;
  role: Role;
  isActive: boolean;
  unitCode: string | null;
  availability: Availability | null;
}

export async function findResponderCandidates(db: Queryable, ids: string[]): Promise<ResponderCandidate[]> {
  const { rows } = await db.query<ResponderCandidate>(
    `SELECT u.id, u.full_name AS "fullName", u.role, u.is_active AS "isActive",
            rp.unit_code AS "unitCode", rp.availability
     FROM users u
     LEFT JOIN responder_profiles rp ON rp.user_id = u.id
     WHERE u.id = ANY($1::uuid[])`,
    [ids],
  );
  return rows;
}

export async function insertAssignment(
  db: Queryable,
  assignment: { incidentId: string; responderId: string; assignedBy: string; notes: string | null },
): Promise<void> {
  await db.query(
    `INSERT INTO incident_assignments (incident_id, responder_id, assigned_by, notes) VALUES ($1, $2, $3, $4)`,
    [assignment.incidentId, assignment.responderId, assignment.assignedBy, assignment.notes],
  );
}

export async function markAssignmentResponding(db: Queryable, id: string): Promise<void> {
  await db.query(`UPDATE incident_assignments SET status = 'RESPONDING', responding_at = now() WHERE id = $1`, [id]);
}

export async function markAssignmentCancelled(db: Queryable, id: string): Promise<void> {
  await db.query(`UPDATE incident_assignments SET status = 'CANCELLED', cancelled_at = now() WHERE id = $1`, [id]);
}

/** Completes every open assignment of the incident and returns the responders involved. */
export async function completeOpenAssignments(db: Queryable, incidentId: string): Promise<string[]> {
  const { rows } = await db.query<{ responderId: string }>(
    `UPDATE incident_assignments SET status = 'COMPLETED', completed_at = now()
     WHERE incident_id = $1 AND status IN ('ASSIGNED', 'RESPONDING')
     RETURNING responder_id AS "responderId"`,
    [incidentId],
  );
  return rows.map((row) => row.responderId);
}

/** Available responders become BUSY when they receive an assignment. */
export async function markRespondersBusy(db: Queryable, responderIds: string[]): Promise<void> {
  await db.query(
    `UPDATE responder_profiles SET availability = 'BUSY'
     WHERE user_id = ANY($1::uuid[]) AND availability = 'AVAILABLE'`,
    [responderIds],
  );
}

/** BUSY responders with no remaining active assignments become AVAILABLE again. */
export async function releaseResponders(db: Queryable, responderIds: string[]): Promise<void> {
  if (responderIds.length === 0) return;
  await db.query(
    `UPDATE responder_profiles rp SET availability = 'AVAILABLE'
     WHERE rp.user_id = ANY($1::uuid[])
       AND rp.availability = 'BUSY'
       AND NOT EXISTS (
         SELECT 1 FROM incident_assignments a
         WHERE a.responder_id = rp.user_id AND a.status IN ('ASSIGNED', 'RESPONDING')
       )`,
    [responderIds],
  );
}
