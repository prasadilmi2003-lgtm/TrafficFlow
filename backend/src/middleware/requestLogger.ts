import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { pinoHttp } from 'pino-http';
import type { Logger } from '../utils/logger.js';

// Only reuse a client-supplied request ID if it is safe to log and echo back.
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{1,128}$/;

/** Express keeps the full URL in originalUrl; req.url is shortened inside routers. */
function fullUrl(req: IncomingMessage): string {
  return (req as IncomingMessage & { originalUrl?: string }).originalUrl ?? req.url ?? '';
}

/**
 * Logs one line per request: method, URL, status code and duration.
 *
 * Every request gets an ID. It is included in every log line for that
 * request, returned in the X-Request-Id response header and included in
 * error responses, so a problem a user reports can be traced in the logs.
 */
export function requestLogger(logger: Logger) {
  return pinoHttp({
    logger,

    genReqId(req, res) {
      const incoming = req.headers['x-request-id'];
      const id = typeof incoming === 'string' && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
      res.setHeader('X-Request-Id', id);
      return id;
    },

    customLogLevel(req, res, error) {
      if (error || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      // Docker and monitoring call the health endpoints every few seconds.
      // Don't flood the logs with successful checks; failures are still logged.
      if (fullUrl(req).startsWith('/api/health')) return 'silent';
      return 'info';
    },
  });
}
