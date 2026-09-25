import type { RequestHandler } from 'express';
import type { Role } from '../types/domain.js';
import { AppError } from '../utils/AppError.js';

/**
 * Allows the request only if the logged-in user has one of `roles`.
 * Must run after authenticate.
 *
 *   router.patch('/:id/verify', authorize('OPERATOR'), ...)
 */
export function authorize(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      throw AppError.unauthorized();
    }
    if (!roles.includes(req.user.role)) {
      throw AppError.forbidden();
    }
    next();
  };
}
