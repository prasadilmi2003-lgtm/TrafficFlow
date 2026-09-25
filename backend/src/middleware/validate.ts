import type { RequestHandler } from 'express';
import type { z } from 'zod';

/**
 * Request validation with Zod schemas. Invalid input throws a ZodError,
 * which the error handler turns into 400 VALIDATION_ERROR with a list of
 * the invalid fields. Valid input is replaced by the parsed value, so
 * controllers receive trimmed, normalised data (e.g. a lower-case email).
 */

export function validateBody(schema: z.ZodType): RequestHandler {
  return (req, _res, next) => {
    req.body = schema.parse(req.body ?? {});
    next();
  };
}
