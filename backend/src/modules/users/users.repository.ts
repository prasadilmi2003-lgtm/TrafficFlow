import type { Queryable } from '../../db/pool.js';
import type { AuthUser, Role } from '../../types/domain.js';

/**
 * All SQL for the users table. Every query is parameterised ($1, $2, …):
 * user input is never joined into SQL text, so SQL injection is impossible.
 */

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
}

const USER_COLUMNS = `
  id,
  full_name AS "fullName",
  email,
  phone,
  role,
  is_active AS "isActive",
  last_login_at AS "lastLoginAt",
  created_at AS "createdAt",
  updated_at AS "updatedAt"`;

export async function findById(db: Queryable, id: string): Promise<UserRecord | null> {
  const { rows } = await db.query<UserRecord>(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [id]);
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

/** The only query that reads the password hash: used by login to check the password. */
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

export async function recordLogin(db: Queryable, id: string): Promise<void> {
  await db.query('UPDATE users SET last_login_at = now() WHERE id = $1', [id]);
}
