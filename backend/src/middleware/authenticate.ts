import type { RequestHandler } from 'express';
import type { Queryable } from '../db/pool.js';
import { SESSION_COOKIE, type TokenService } from '../modules/auth/tokens.js';
import { findAuthUser } from '../modules/users/users.repository.js';
import { AppError } from '../utils/AppError.js';
import { readCookie } from '../utils/http.js';

/**
 * Requires a valid session. Reads the JWT from the session cookie, checks
 * its signature and expiry, then loads the user from the database and
 * attaches it as req.user.
 *
 * The user is re-read on every request (one indexed query), so deactivating
 * an account or changing its role takes effect immediately rather than when
 * the token expires.
 */
export function authenticate({ db, tokens }: { db: Queryable; tokens: TokenService }): RequestHandler {
  return async (req, res, next) => {
    const token = readCookie(req, SESSION_COOKIE);
    if (!token) {
      throw AppError.unauthorized();
    }

    const payload = tokens.verify(token);
    if (!payload) {
      tokens.clearCookie(res);
      throw AppError.unauthorized('SESSION_EXPIRED', 'Your session has expired. Please log in again.');
    }

    const user = await findAuthUser(db, payload.userId);
    if (!user || !user.isActive) {
      tokens.clearCookie(res);
      throw AppError.unauthorized('SESSION_EXPIRED', 'Your session is no longer valid. Please log in again.');
    }

    req.user = { id: user.id, fullName: user.fullName, email: user.email, role: user.role };
    next();
  };
}
