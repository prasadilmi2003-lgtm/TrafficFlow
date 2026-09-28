import type { Queryable } from '../../db/pool.js';
import type { Availability, ResponderType } from '../../types/domain.js';

export interface ResponderRecord {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  responderType: ResponderType;
  unitCode: string;
  availability: Availability;
  vehicleRegistration: string | null;
  vehicleDescription: string | null;
  activeAssignments: number;
}

const COLUMNS = `
  u.id,
  u.full_name AS "fullName",
  u.email,
  u.phone,
  u.is_active AS "isActive",
  rp.responder_type AS "responderType",
  rp.unit_code AS "unitCode",
  rp.availability,
  rp.vehicle_registration AS "vehicleRegistration",
  rp.vehicle_description AS "vehicleDescription",
  (SELECT count(*)::int FROM incident_assignments a
    WHERE a.responder_id = u.id AND a.status IN ('ASSIGNED', 'ACCEPTED', 'RESPONDING')) AS "activeAssignments"`;

const FROM = `
  FROM responder_profiles rp
  JOIN users u ON u.id = rp.user_id`;

export async function list(
  db: Queryable,
  filters: { responderType?: ResponderType; availability?: Availability; includeInactive: boolean },
): Promise<ResponderRecord[]> {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (!filters.includeInactive) conditions.push('u.is_active');
  if (filters.responderType) {
    values.push(filters.responderType);
    conditions.push(`rp.responder_type = $${values.length}`);
  }
  if (filters.availability) {
    values.push(filters.availability);
    conditions.push(`rp.availability = $${values.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await db.query<ResponderRecord>(
    `SELECT ${COLUMNS} ${FROM} ${where}
     ORDER BY CASE rp.availability WHEN 'AVAILABLE' THEN 0 WHEN 'BUSY' THEN 1 ELSE 2 END,
              rp.responder_type, rp.unit_code`,
    values,
  );
  return rows;
}

export async function findById(db: Queryable, userId: string): Promise<ResponderRecord | null> {
  const { rows } = await db.query<ResponderRecord>(`SELECT ${COLUMNS} ${FROM} WHERE u.id = $1`, [userId]);
  return rows[0] ?? null;
}

export interface ProfileChanges {
  responderType?: ResponderType;
  unitCode?: string;
  availability?: Availability;
  /** null clears the value; undefined keeps it */
  vehicleRegistration?: string | null;
  vehicleDescription?: string | null;
}

export async function updateProfile(db: Queryable, userId: string, changes: ProfileChanges): Promise<void> {
  // COALESCE keeps the current value for fields that were not sent. The
  // vehicle fields can also be cleared, so they use a "was it sent" flag.
  await db.query(
    `UPDATE responder_profiles SET
       responder_type = COALESCE($2, responder_type),
       unit_code = COALESCE($3, unit_code),
       availability = COALESCE($4, availability),
       vehicle_registration = CASE WHEN $5::boolean THEN $6 ELSE vehicle_registration END,
       vehicle_description = CASE WHEN $7::boolean THEN $8 ELSE vehicle_description END
     WHERE user_id = $1`,
    [
      userId,
      changes.responderType ?? null,
      changes.unitCode ?? null,
      changes.availability ?? null,
      changes.vehicleRegistration !== undefined,
      changes.vehicleRegistration ?? null,
      changes.vehicleDescription !== undefined,
      changes.vehicleDescription ?? null,
    ],
  );
}
