import type { RequestHandler } from 'express';

const ALLOWED_METHODS = 'GET, POST, PATCH, DELETE, OPTIONS';
const ALLOWED_HEADERS = 'Content-Type';
const PREFLIGHT_CACHE_SECONDS = '600';

/**
 * Cross-origin requests (CORS) for the browser origins in CORS_ORIGINS.
 *
 * The web app normally talks to the API on the same origin (through the Vite
 * proxy in development and Nginx in production), so no CORS headers are
 * needed and none are sent. When the frontend is served from another origin,
 * list it in CORS_ORIGINS: only those origins may call the API with the
 * session cookie (credentials). Requests from any other origin get no CORS
 * headers, so the browser blocks them from reading the response.
 */
export function cors(allowedOrigins: readonly string[]): RequestHandler {
  const allowed = new Set(allowedOrigins);

  return (req, res, next) => {
    const origin = req.headers.origin;
    const isAllowed = origin !== undefined && allowed.has(origin);

    // Responses differ by Origin, so caches must keep them apart
    if (allowed.size > 0) res.vary('Origin');

    if (isAllowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    // Preflight: the browser asks before a cross-origin POST/PATCH with JSON
    if (req.method === 'OPTIONS' && req.headers['access-control-request-method']) {
      if (isAllowed) {
        res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS);
        res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS);
        res.setHeader('Access-Control-Max-Age', PREFLIGHT_CACHE_SECONDS);
      }
      res.status(204).end();
      return;
    }

    next();
  };
}
