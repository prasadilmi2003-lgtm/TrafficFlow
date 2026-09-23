import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildTestApp } from './helpers.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('GET /api/v1', () => {
  it('returns information about the API', async () => {
    const { app } = buildTestApp();

    const res = await request(app).get('/api/v1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ name: 'TrafficFlow API', version: 'v1' });
  });
});

describe('unknown routes', () => {
  it('return 404 in the standard error format', async () => {
    const { app } = buildTestApp();

    const res = await request(app).get('/api/v1/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Route GET /api/v1/does-not-exist not found',
        requestId: res.headers['x-request-id'],
      },
    });
  });
});

describe('request bodies', () => {
  it('rejects malformed JSON with 400', async () => {
    const { app } = buildTestApp();

    const res = await request(app)
      .post('/api/v1')
      .set('Content-Type', 'application/json')
      .send('{"description": ');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  it('rejects bodies larger than 100 kB with 413', async () => {
    const { app } = buildTestApp();

    const res = await request(app)
      .post('/api/v1')
      .send({ description: 'x'.repeat(150_000) });

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});

describe('security headers', () => {
  it('are added to every response', async () => {
    const { app } = buildTestApp();

    const res = await request(app).get('/api/health');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('request IDs', () => {
  it('are generated for every request', async () => {
    const { app } = buildTestApp();

    const res = await request(app).get('/api/v1');

    expect(res.headers['x-request-id']).toMatch(UUID);
  });

  it('reuse a valid X-Request-Id sent by the caller', async () => {
    const { app } = buildTestApp();

    const res = await request(app).get('/api/v1').set('X-Request-Id', 'nginx-7f3a9c');

    expect(res.headers['x-request-id']).toBe('nginx-7f3a9c');
  });

  it('replace an X-Request-Id that is unsafe to log', async () => {
    const { app } = buildTestApp();

    const res = await request(app).get('/api/v1').set('X-Request-Id', 'bad id <script>');

    expect(res.headers['x-request-id']).toMatch(UUID);
  });
});

describe('rate limiting', () => {
  it('returns 429 once a client exceeds the limit', async () => {
    const { app } = buildTestApp({ env: { RATE_LIMIT_MAX: '2' } });

    await request(app).get('/api/v1').expect(200);
    await request(app).get('/api/v1').expect(200);
    const res = await request(app).get('/api/v1');

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });

  it('never limits the health endpoints', async () => {
    const { app } = buildTestApp({ env: { RATE_LIMIT_MAX: '1' } });

    for (let i = 0; i < 3; i += 1) {
      await request(app).get('/api/health').expect(200);
    }
  });
});
