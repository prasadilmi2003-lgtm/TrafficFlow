import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { AppError } from '../src/utils/AppError.js';
import { createLogger } from '../src/utils/logger.js';

/** A small app with routes that throw, using the real error handler. */
function appThatThrows(error: unknown) {
  const app = express();
  app.get('/sync', () => {
    throw error;
  });
  app.get('/async', async () => {
    throw error;
  });
  app.use(errorHandler(createLogger({ logLevel: 'silent', appVersion: 'test' })));
  return app;
}

describe('errorHandler', () => {
  it('sends an AppError with its own status, code, message and details', async () => {
    const app = appThatThrows(
      new AppError(409, 'INVALID_STATUS_TRANSITION', 'Cannot move incident from REPORTED to RESOLVED', {
        from: 'REPORTED',
        to: 'RESOLVED',
      }),
    );

    const res = await request(app).get('/sync');

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: {
        code: 'INVALID_STATUS_TRANSITION',
        message: 'Cannot move incident from REPORTED to RESOLVED',
        details: { from: 'REPORTED', to: 'RESOLVED' },
      },
    });
  });

  it('hides the details of unexpected errors behind a generic 500', async () => {
    const app = appThatThrows(new Error('password authentication failed for user "admin"'));

    const res = await request(app).get('/sync');

    expect(res.status).toBe(500);
    expect(res.body.error).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    });
    expect(JSON.stringify(res.body)).not.toContain('password');
  });

  it('also handles errors thrown inside async route handlers', async () => {
    const app = appThatThrows(AppError.notFound('Incident not found'));

    const res = await request(app).get('/async');

    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Incident not found');
  });

  it('answers 503 with Retry-After when PostgreSQL cannot be reached, without revealing why', async () => {
    const refused = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), { code: 'ECONNREFUSED' });
    const app = appThatThrows(refused);

    const res = await request(app).get('/async');

    expect(res.status).toBe(503);
    expect(res.headers['retry-after']).toBe('10');
    expect(res.body.error).toEqual({
      code: 'SERVICE_UNAVAILABLE',
      message: 'The service is temporarily unavailable. Please try again in a moment.',
    });
    expect(JSON.stringify(res.body)).not.toContain('5432');
  });

  it('still answers 500 for query errors that are bugs, not outages', async () => {
    const syntaxError = Object.assign(new Error('syntax error at or near "SELEC"'), { code: '42601' });

    const res = await request(appThatThrows(syntaxError)).get('/sync');

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
  });
});
