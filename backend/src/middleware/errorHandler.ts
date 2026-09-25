import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { isDatabaseUnavailable } from '../db/errors.js';
import { AppError } from '../utils/AppError.js';
import type { Logger } from '../utils/logger.js';

/** The shape of every error response the API sends. */
export interface ErrorResponseBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

interface ClientError {
  status: number;
  code: string;
  message: string;
  details?: unknown;
}

/** Errors raised by express.json() carry a `type` such as "entity.parse.failed". */
function isBodyParserError(error: unknown): error is { type: string; status: number } {
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { type?: unknown }).type === 'string' &&
    typeof (error as { status?: unknown }).status === 'number'
  );
}

/** Converts a known error into a client response. Returns undefined for unexpected errors. */
function toClientError(error: unknown): ClientError | undefined {
  if (error instanceof AppError) {
    return { status: error.statusCode, code: error.code, message: error.message, details: error.details };
  }

  if (error instanceof ZodError) {
    return {
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Some of the information provided is invalid',
      details: error.issues.map((issue) => ({ field: issue.path.map(String).join('.'), message: issue.message })),
    };
  }

  if (isBodyParserError(error)) {
    if (error.type === 'entity.parse.failed') {
      return { status: 400, code: 'INVALID_JSON', message: 'Request body is not valid JSON' };
    }
    if (error.type === 'entity.too.large') {
      return { status: 413, code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' };
    }
    if (error.status >= 400 && error.status < 500) {
      return { status: error.status, code: 'BAD_REQUEST', message: 'Request body could not be read' };
    }
  }

  if (isDatabaseUnavailable(error)) {
    return {
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
      message: 'The service is temporarily unavailable. Please try again in a moment.',
    };
  }

  return undefined;
}

/**
 * The single place where errors become HTTP responses.
 *
 * - Expected errors (AppError, validation errors, invalid JSON) are sent
 *   with their own status code and message.
 * - If PostgreSQL is down or refusing connections, the client receives 503
 *   with a Retry-After header, and the cause is logged.
 * - Anything else is a bug: it is logged in full, and the client receives a
 *   generic 500 response. Stack traces and internal messages are never sent.
 *
 * Express 5 forwards errors thrown in async route handlers here automatically.
 */
export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (error, req, res, next) => {
    // If part of the response was already sent, Express must close the connection.
    if (res.headersSent) {
      next(error);
      return;
    }

    // Set by the request logger (middleware/requestLogger.ts)
    const id: unknown = (req as { id?: unknown }).id;
    const requestId = typeof id === 'string' ? id : undefined;
    let clientError = toClientError(error);

    if (!clientError) {
      logger.error({ err: error, reqId: requestId }, 'Unhandled error');
      clientError = { status: 500, code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' };
    } else if (clientError.status === 503) {
      logger.error({ err: error, reqId: requestId }, 'Database unavailable');
      res.set('Retry-After', '10');
    }

    const body: ErrorResponseBody = {
      error: {
        code: clientError.code,
        message: clientError.message,
        ...(clientError.details !== undefined && { details: clientError.details }),
        ...(requestId !== undefined && { requestId }),
      },
    };

    res.status(clientError.status).json(body);
  };
}
