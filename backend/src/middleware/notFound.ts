import type { RequestHandler } from 'express';
import { AppError } from '../utils/AppError.js';

/** Runs when no route matched the request: responds with 404 in the standard error format. */
export const notFound: RequestHandler = (req, _res, next) => {
  next(AppError.notFound(`Route ${req.method} ${req.path} not found`));
};
