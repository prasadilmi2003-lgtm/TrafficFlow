import type { IncomingMessage } from 'node:http';
import type { AuthUser } from '../types/domain.js';
import { AppError } from './AppError.js';

/** Returns the logged-in user, or throws 401 if the route forgot to authenticate. */
export function requireUser(req: { user?: AuthUser }): AuthUser {
  if (!req.user) {
    throw AppError.unauthorized();
  }
  return req.user;
}

/**
 * Reads one cookie from the request. The session cookie holds a JWT, which
 * only contains URL-safe characters, so no cookie-parsing library is needed.
 */
export function readCookie(req: IncomingMessage, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() === name) {
      return decodeURIComponent(part.slice(separator + 1).trim());
    }
  }
  return undefined;
}
