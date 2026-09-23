/**
 * An expected error that should be reported to the client, such as
 * "404 Not Found" or "409 Conflict".
 *
 * Services and controllers throw an AppError; the central error handler
 * (middleware/errorHandler.ts) turns it into a JSON response. Code that
 * throws never needs to know about the response format.
 */
export class AppError extends Error {
  /** HTTP status code sent to the client, e.g. 404 */
  readonly statusCode: number;
  /** Machine-readable error code, e.g. "NOT_FOUND" */
  readonly code: string;
  /** Optional extra information for the client, e.g. which fields are invalid */
  readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  static notFound(message = 'Resource not found'): AppError {
    return new AppError(404, 'NOT_FOUND', message);
  }

  static tooManyRequests(message = 'Too many requests, please try again later'): AppError {
    return new AppError(429, 'RATE_LIMITED', message);
  }
}
