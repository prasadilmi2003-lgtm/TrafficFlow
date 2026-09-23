import { rateLimit } from 'express-rate-limit';
import type { AppConfig } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

/**
 * Limits how many requests one client IP can make to the API in a time window.
 *
 * Counts are kept in memory, which is fine for a single API instance.
 * Stricter limits for login and registration are added in Phase 4.
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
