import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildTestApp, TEST_ENV } from './helpers.js';

/**
 * Access-control checks that run without a database: every one of these
 * requests is refused before any query is made.
 */
describe('authentication', () => {
  it.each(['/api/v1/auth/me', '/api/v1/protected-test'])('GET %s returns 401 without a session', async (path) => {
    const { app } = buildTestApp();

    const res = await request(app).get(path);

    expect(res.status).toBe(401);
    expect(res.body.error).toMatchObject({ code: 'AUTH_REQUIRED', message: 'Please log in to continue' });
  });

  it('rejects a session cookie that is not a valid token', async () => {
    const { app } = buildTestApp();

    const res = await request(app).get('/api/v1/protected-test').set('Cookie', 'tf_session=not-a-real-token');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('SESSION_EXPIRED');
  });

  it('rejects a token signed with a different secret and clears the cookie', async () => {
    const { app } = buildTestApp();
    const forged = jwt.sign({ role: 'ADMIN' }, 'a-completely-different-secret-value-123', {
      subject: '5f0c6a3e-8f7b-4c2d-9a1e-3b4c5d6e7f80',
      issuer: 'trafficflow',
    });

    const res = await request(app).get('/api/v1/protected-test').set('Cookie', `tf_session=${forged}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('SESSION_EXPIRED');
    expect(String(res.headers['set-cookie'])).toMatch(/tf_session=;/);
  });

  it('rejects an expired token', async () => {
    const { app } = buildTestApp();
    const expired = jwt.sign({ role: 'ADMIN', exp: Math.floor(Date.now() / 1000) - 60 }, TEST_ENV.JWT_SECRET, {
      subject: '5f0c6a3e-8f7b-4c2d-9a1e-3b4c5d6e7f80',
      issuer: 'trafficflow',
    });

    const res = await request(app).get('/api/v1/auth/me').set('Cookie', `tf_session=${expired}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('SESSION_EXPIRED');
  });

  it('logout always succeeds and clears the session cookie', async () => {
    const { app } = buildTestApp();

    const res = await request(app).post('/api/v1/auth/logout');

    expect(res.status).toBe(204);
    expect(String(res.headers['set-cookie'])).toMatch(/tf_session=;.*HttpOnly/i);
  });
});

describe('input validation', () => {
  it('rejects an invalid registration with 400 and a list of fields', async () => {
    const { app } = buildTestApp();

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ fullName: 'A', email: 'not-an-email', password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const fields = new Set((res.body.error.details as Array<{ field: string }>).map((d) => d.field));
    expect([...fields].sort()).toEqual(['email', 'fullName', 'password']);
  });

  it('rejects a login without a password', async () => {
    const { app } = buildTestApp();

    const res = await request(app).post('/api/v1/auth/login').send({ email: 'a@b.com' });

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe('password');
  });
});
