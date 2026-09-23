/** PostgreSQL error code for "unique_violation" */
const UNIQUE_VIOLATION = '23505';

/**
 * True if `error` is a PostgreSQL unique-constraint violation, optionally
 * for a specific constraint or unique index (e.g. "users_email_lower_key").
 */
export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { code, constraint: violated } = error as { code?: unknown; constraint?: unknown };
  return code === UNIQUE_VIOLATION && (constraint === undefined || violated === constraint);
}
