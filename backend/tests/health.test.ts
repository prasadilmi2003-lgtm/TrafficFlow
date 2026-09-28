import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildTestApp } from './helpers.js';

describe('GET /api/health (liveness)', () => {
  it('returns 200 with service information', async () => {
    const { app } = buildTestApp({ env: { APP_VERSION: 'abc1234' } });

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toMatchObject({
      status: 'ok',
      service: 'trafficflow-backend',
      version: 'abc1234',
    });
    expect(res.body.uptimeSeconds).toBeTypeOf('number');
    expect(Number.isNaN(Date.parse(res.body.timestamp))).toBe(false);
  });

  it('tells proxies and browsers not to cache the result', async () => {
    const { app } = buildTestApp();

    const res = await request(app).get('/api/health');

    expect(res.headers['cache-control']).toBe('no-store');
  });
});

describe('GET /api/health/ready (readiness)', () => {
  it('is ready when there are no dependencies to check', async () => {
    const { app } = buildTestApp();

    const res = await request(app).get('/api/health/ready');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ready', checks: {} });
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('reports a working dependency as up', async () => {
    const { app } = buildTestApp({
      checks: [{ name: 'database', check: async () => 'ok' }],
    });

    const res = await request(app).get('/api/health/ready');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
    expect(res.body.checks.database.status).toBe('up');
    expect(res.body.checks.database.responseTimeMs).toBeTypeOf('number');
  });

  it('returns 503 when a dependency fails, without exposing the error', async () => {
    const { app } = buildTestApp({
      checks: [
        {
          name: 'database',
          check: async () => {
            throw new Error('connect ECONNREFUSED 10.0.0.5:5432');
          },
        },
      ],
    });

    const res = await request(app).get('/api/health/ready');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('not_ready');
    expect(res.body.checks.database.status).toBe('down');
    expect(JSON.stringify(res.body)).not.toContain('ECONNREFUSED');
  });

  it('returns 503 when a dependency does not answer in time', async () => {
    const { app } = buildTestApp({
      readinessTimeoutMs: 50,
      checks: [{ name: 'database', check: () => new Promise(() => {}) }],
    });

    const res = await request(app).get('/api/health/ready');

    expect(res.status).toBe(503);
    expect(res.body.checks.database.status).toBe('down');
  });

  it('shows which dependency is down when several are checked', async () => {
    const { app } = buildTestApp({
      checks: [
        { name: 'database', check: async () => 'ok' },
        {
          name: 'storage',
          check: async () => {
            throw new Error('disk not mounted');
          },
        },
      ],
    });

    const res = await request(app).get('/api/health/ready');

    expect(res.status).toBe(503);
    expect(res.body.checks.database.status).toBe('up');
    expect(res.body.checks.storage.status).toBe('down');
  });

  it('returns 503 once shutdown has started', async () => {
    const { app, health } = buildTestApp();

    health.markShuttingDown();
    const res = await request(app).get('/api/health/ready');

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'shutting_down', checks: {} });
  });
});
