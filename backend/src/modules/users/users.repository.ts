import type { Queryable } from '../../db/pool.js';
import type { AuthUser, Availability, ResponderType, Role } from '../../types/domain.js';
import { escapeLike, offsetOf, type PageRequest } from '../../utils/pagination.js';

export interface ResponderProfile {
  responderType: ResponderType;
  unitCode: string;
  availability: Availability;
}

/** A user as returned by the API. Never includes the password hash. */
export interface UserRecord {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: Role;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  responderProfile: ResponderProfile | null;
}

const USER_COLUMNS = `
  u.id,
  u.full_name AS "fullName",
  u.email,
  u.phone,
  u.role,
  u.is_active AS "isActive",
  u.last_login_at AS "lastLoginAt",
  u.created_at AS "createdAt",
  u.updated_at AS "updatedAt",
  CASE WHEN rp.user_id IS NULL THEN NULL
       ELSE json_build_object(
         'responderType', rp.responder_type,
         'unitCode', rp.unit_code,
         'availability', rp.availability)
  END AS "responderProfile"`;

const USERS_FROM = `
  FROM users u
  LEFT JOIN responder_profiles rp ON rp.user_id = u.id`;

export async function findById(db: Queryable, id: string): Promise<UserRecord | null> {
  const { rows } = await db.query<UserRecord>(`SELECT ${USER_COLUMNS} ${USERS_FROM} WHERE u.id = $1`, [id]);
  return rows[0] ?? null;
}

/** Used on every authenticated request to confirm the account still exists and is active. */
export async function findAuthUser(db: Queryable, id: string): Promise<(AuthUser & { isActive: boolean }) | null> {
  const { rows } = await db.query<AuthUser & { isActive: boolean }>(
    `SELECT id, full_name AS "fullName", email, role, is_active AS "isActive" FROM users WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export interface Credentials extends AuthUser {
  passwordHash: string;
  isActive: boolean;
}

export async function findCredentialsByEmail(db: Queryable, email: string): Promise<Credentials | null> {
  const { rows } = await db.query<Credentials>(
    `SELECT id, full_name AS "fullName", email, role, is_active AS "isActive", password_hash AS "passwordHash"
     FROM users WHERE LOWER(email) = LOWER($1)`,
    [email],
  );
  return rows[0] ?? null;
}

export interface NewUser {
  fullName: string;
  email: string;
  phone: string | null;
  passwordHash: string;
  role: Role;
}

export async function insertUser(db: Queryable, user: NewUser): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO users (full_name, email, phone, password_hash, role)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [user.fullName, user.email, user.phone, user.passwordHash, user.role],
  );
  return rows[0]!.id;
}

export async function insertResponderProfile(
  db: Queryable,
  userId: string,
  profile: { responderType: ResponderType; unitCode: string },
): Promise<void> {
  await db.query(
    `INSERT INTO responder_profiles (user_id, responder_type, unit_code) VALUES ($1, $2, $3)`,
    [userId, profile.responderType, profile.unitCode],
  );
}

export interface UserChanges {
  fullName?: string;
  phone?: string | null;
  role?: Role;
  isActive?: boolean;
  passwordHash?: string;
}

const CHANGE_COLUMNS: Record<keyof UserChanges, string> = {
  fullName: 'full_name',
  phone: 'phone',
  role: 'role',
  isActive: 'is_active',
  passwordHash: 'password_hash',
};

export async function updateUser(db: Queryable, id: string, changes: UserChanges): Promise<void> {
  const entries = Object.entries(changes).filter(([, value]) => value !== undefined) as [keyof UserChanges, unknown][];
  if (entries.length === 0) return;

  // Column names come from the fixed map above, never from user input.
  const assignments = entries.map(([field], index) => `${CHANGE_COLUMNS[field]} = $${index + 2}`);
  await db.query(`UPDATE users SET ${assignments.join(', ')} WHERE id = $1`, [id, ...entries.map(([, value]) => value)]);
}

export async function recordLogin(db: Queryable, id: string): Promise<void> {
  await db.query('UPDATE users SET last_login_at = now() WHERE id = $1', [id]);
}

export interface UserListFilters extends PageRequest {
  role?: Role;
  isActive?: boolean;
  search?: string;
}

export async function list(db: Queryable, filters: UserListFilters): Promise<{ items: UserRecord[]; total: number }> {
  const conditions: string[] = [];
  const values: unknown[] = [];
  const add = (condition: (placeholder: string) => string, value: unknown) => {
    values.push(value);
    conditions.push(condition(`$${values.length}`));
  };

  if (filters.role) add((p) => `u.role = ${p}`, filters.role);
  if (filters.isActive !== undefined) add((p) => `u.is_active = ${p}`, filters.isActive);
  if (filters.search) {
    add((p) => `(u.full_name ILIKE ${p} OR u.email ILIKE ${p} OR rp.unit_code ILIKE ${p})`, `%${escapeLike(filters.search)}%`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const pageValues = [...values, filters.limit, offsetOf(filters)];

  const [itemsResult, countResult] = await Promise.all([
    db.query<UserRecord>(
      `SELECT ${USER_COLUMNS} ${USERS_FROM} ${where}
       ORDER BY u.created_at DESC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      pageValues,
    ),
    db.query<{ total: number }>(`SELECT count(*)::int AS total ${USERS_FROM} ${where}`, values),
  ]);

  return { items: itemsResult.rows, total: countResult.rows[0]?.total ?? 0 };
}

/** Number of assignments the responder is still working on. */
export async function countActiveAssignments(db: Queryable, responderId: string): Promise<number> {
  const { rows } = await db.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM incident_assignments
     WHERE responder_id = $1 AND status IN ('ASSIGNED', 'RESPONDING')`,
    [responderId],
  );
  return rows[0]?.count ?? 0;
}
