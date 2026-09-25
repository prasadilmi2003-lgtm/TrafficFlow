/**
 * Domain values shared across the backend. They match the PostgreSQL enum
 * type created in database/migrations/001_create_types_and_functions.sql.
 */

export const ROLES = ['CITIZEN', 'OPERATOR', 'RESPONDER', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

/** The logged-in user, attached to each authenticated request as req.user */
export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: Role;
}
