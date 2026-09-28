/**
 * Helpers for building DATABASE_URL and saving it in backend/.env. Used by
 * `npm run db:configure`, which asks for the password so nobody has to
 * URL-encode it by hand.
 */

export interface ConnectionParts {
  host: string;
  port: number;
  user: string;
  /** Empty when PostgreSQL doesn't ask for one (for example "trust" authentication) */
  password: string;
  database: string;
}

/**
 * A postgres:// connection string. Every part is URL-encoded, so passwords
 * with characters such as @ : / # % or spaces work unchanged.
 */
export function buildDatabaseUrl(parts: ConnectionParts): string {
  const user = encodeURIComponent(parts.user);
  const credentials = parts.password ? `${user}:${encodeURIComponent(parts.password)}` : user;
  const host = parts.host.includes(':') && !parts.host.startsWith('[') ? `[${parts.host}]` : parts.host;
  return `postgres://${credentials}@${host}:${parts.port}/${encodeURIComponent(parts.database)}`;
}

/** Host, port, user and database of a connection string (never the password), or undefined if it can't be read. */
export function readConnectionParts(databaseUrl: string | undefined): Omit<ConnectionParts, 'password'> | undefined {
  if (!databaseUrl) return undefined;
  try {
    const url = new URL(databaseUrl);
    if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') return undefined;
    return {
      host: url.hostname.replace(/^\[(.*)\]$/, '$1') || 'localhost',
      port: Number(url.port || '5432'),
      user: decodeURIComponent(url.username) || 'postgres',
      database: decodeURIComponent(url.pathname.slice(1)) || 'trafficflow',
    };
  } catch {
    return undefined;
  }
}

/**
 * Sets `key=value` in the text of a .env file: the first existing line for
 * the key is replaced, later duplicates are removed (only the first one
 * would be used anyway) and a missing key is added at the end. Every other
 * line, including comments, is kept exactly as it was, and so is the
 * file's line-ending style.
 */
export function setEnvValue(content: string, key: string, value: string): string {
  const newline = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = content.length > 0 ? content.split(/\r?\n/) : [];
  const pattern = new RegExp(`^\\s*(export\\s+)?${key}\\s*=`);
  const result: string[] = [];
  let found = false;

  for (const line of lines) {
    if (pattern.test(line)) {
      if (!found) result.push(`${key}=${value}`);
      found = true;
    } else {
      result.push(line);
    }
  }

  if (!found) {
    // Keep a trailing newline at the end of the file
    if (result.length > 0 && result[result.length - 1] === '') result.pop();
    result.push(`${key}=${value}`, '');
  }
  return result.join(newline);
}

/** True if `name` is safe to use as a database name without quoting surprises. */
export function isSimpleDatabaseName(name: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(name);
}
