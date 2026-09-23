import type { RequestHandler } from 'express';
import type { z } from 'zod';

/**
 * Request validation with Zod schemas. Invalid input throws a ZodError,
 * which the error handler turns into 400 VALIDATION_ERROR with a list of
 * the invalid fields. Valid input is replaced by the parsed value, so
 * controllers receive trimmed, converted data (e.g. numbers, not strings).
 */

export function validateBody(schema: z.ZodType): RequestHandler {
  return (req, _res, next) => {
    req.body = schema.parse(req.body ?? {});
    next();
  };
}

export function validateParams(schema: z.ZodType): RequestHandler {
  return (req, _res, next) => {
    req.params = schema.parse(req.params) as typeof req.params;
    next();
  };
}

/**
 * Express 5 makes req.query read-only, so the parsed query is stored in
 * res.locals.query instead.
 */
export function validateQuery(schema: z.ZodType): RequestHandler {
  return (req, res, next) => {
    res.locals.query = schema.parse(req.query);
    next();
  };
}
