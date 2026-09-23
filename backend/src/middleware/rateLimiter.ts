import { rateLimit } from 'express-rate-limit';
import type { AppConfig } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

/**
 * Limits how many requests one client IP can make to the API in a time window.
 * Counts are kept in memory, which is fine for a single API instance.
 */
export function apiRateLimiter(options: AppConfig['rateLimit']) {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.max,
    // Send the standard RateLimit headers so clients can see their remaining quota
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    // Hand over to the central error handler so the response has the usual format
    handler: (_req, _res, next) => {
      next(AppError.tooManyRequests());
    },
  });
}

/**
 * Stricter limit for login and registration, against password guessing.
 * Only failed attempts count, so normal logins are never blocked.
 */
export function loginRateLimiter(options: AppConfig['rateLimit']) {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.authMax,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(AppError.tooManyRequests('Too many failed attempts. Please wait a few minutes and try again.'));
    },
  });
}
