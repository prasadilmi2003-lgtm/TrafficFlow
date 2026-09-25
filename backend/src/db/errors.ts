/** PostgreSQL error code for "unique_violation" */
const UNIQUE_VIOLATION = '23505';

/** Node.js network error codes: the database server could not be reached. */
const NETWORK_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EPIPE',
]);

/**
 * PostgreSQL error codes (SQLSTATE) meaning the database can't serve
 * requests right now. None of them is the client's fault:
 *   08xxx          connection problems
 *   28xxx          user or password in DATABASE_URL rejected
 *   3D000          the database in DATABASE_URL doesn't exist
 *   53300          too many connections
 *   57P01..57P03   the server is shutting down or starting up
 */
const UNAVAILABLE_SQLSTATE = /^(08|28)[0-9A-Z]{3}$|^3D000$|^53300$|^57P0[1-3]$/;

/** pg and pg-pool report connection timeouts and dropped connections without a code. */
const UNAVAILABLE_MESSAGES = [/timeout exceeded when trying to connect/i, /^Connection terminated/i];

function errorCode(error: unknown): unknown {
  return typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined;
}

/**
 * True if `error` is a PostgreSQL unique-constraint violation, optionally
 * for a specific constraint or unique index (e.g. "users_email_lower_key").
 */
export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { code, constraint: violated } = error as { code?: unknown; constraint?: unknown };
  return code === UNIQUE_VIOLATION && (constraint === undefined || violated === constraint);
}

/**
 * True if `error` means the database is unreachable or refusing
 * connections, as opposed to a problem with one particular query. The API
 * answers these with 503 Service Unavailable instead of 500.
 */
export function isDatabaseUnavailable(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;

  const code = errorCode(error);
  if (typeof code === 'string' && (NETWORK_ERROR_CODES.has(code) || UNAVAILABLE_SQLSTATE.test(code))) {
    return true;
  }

  const { message } = error as { message?: unknown };
  if (typeof message === 'string' && UNAVAILABLE_MESSAGES.some((pattern) => pattern.test(message))) {
    return true;
  }

  // "localhost" resolves to both IPv6 and IPv4, so Node.js can report a
  // refused connection as an AggregateError containing one error per address.
  const { errors } = error as { errors?: unknown };
  return Array.isArray(errors) && errors.some(isDatabaseUnavailable);
}

/** "user@host:port/database" from a connection string. The password is never included. */
export function describeDatabaseUrl(databaseUrl: string): string {
  try {
    const url = new URL(databaseUrl);
    return `${decodeURIComponent(url.username)}@${url.hostname}:${url.port || '5432'}${url.pathname}`;
  } catch {
    return 'the database in DATABASE_URL';
  }
}

/**
 * A one-line explanation of a database error for the command-line scripts
 * and the startup log, or undefined if it isn't a problem the user can fix
 * by starting or configuring PostgreSQL.
 */
export function explainDatabaseError(error: unknown, databaseUrl: string): string | undefined {
  const target = describeDatabaseUrl(databaseUrl);
  const code = errorCode(error);

  if (code === '28P01' || code === '28000') {
    return `PostgreSQL rejected the user or password for ${target}. Check DATABASE_URL in backend/.env.`;
  }
  if (code === '3D000') {
    return `The database ${target} does not exist. Create it first (see backend/README.md, "Start PostgreSQL").`;
  }
  if (code === '42P01') {
    return 'The database tables do not exist yet. Run the migrations first: npm run db:migrate';
  }
  if (isDatabaseUnavailable(error)) {
    return `Cannot connect to PostgreSQL at ${target}. Is it running? With Docker: docker compose up -d db`;
  }
  return undefined;
}
