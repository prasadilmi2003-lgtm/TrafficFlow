import type { Response } from 'express';
import jwt from 'jsonwebtoken';
import type { AppConfig } from '../../config/env.js';
import type { AuthUser, Role } from '../../types/domain.js';

/** Name of the cookie that carries the session token. */
export const SESSION_COOKIE = 'tf_session';

const ISSUER = 'trafficflow';

export interface TokenPayload {
  userId: string;
  role: Role;
}

/**
 * Issues and checks the JSON Web Tokens used as session tokens.
 *
 * The token is sent to the browser in an httpOnly cookie: JavaScript on the
 * page can't read it, so a cross-site scripting bug can't steal it.
 * SameSite=Lax stops other websites from sending it with their requests.
 */
export function createTokenService(auth: AppConfig['auth']) {
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: auth.cookieSecure,
    path: '/',
  };

  return {
    sign(user: AuthUser): string {
      return jwt.sign({ role: user.role }, auth.jwtSecret, {
        algorithm: 'HS256',
        subject: user.id,
        issuer: ISSUER,
        expiresIn: auth.jwtExpiresInSeconds,
      });
    },

    /** Returns the payload of a valid token, or null if it is invalid or expired. */
    verify(token: string): TokenPayload | null {
      try {
        const payload = jwt.verify(token, auth.jwtSecret, { algorithms: ['HS256'], issuer: ISSUER });
        if (typeof payload === 'string' || typeof payload.sub !== 'string') return null;
        return { userId: payload.sub, role: payload.role as Role };
      } catch {
        return null;
      }
    },

    setCookie(res: Response, token: string): void {
      res.cookie(SESSION_COOKIE, token, { ...cookieOptions, maxAge: auth.jwtExpiresInSeconds * 1000 });
    },

    clearCookie(res: Response): void {
      res.clearCookie(SESSION_COOKIE, cookieOptions);
    },
  };
}

export type TokenService = ReturnType<typeof createTokenService>;
