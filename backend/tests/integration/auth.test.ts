import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadEnvFile } from '../../src/config/env.js';
import { runMigrations } from '../../src/db/migrate.js';
import { createPool, type Pool } from '../../src/db/pool.js';
import { databaseReadinessChecks } from '../../src/db/readiness.js';
import { buildTestApp } from '../helpers.js';

/**
 * End-to-end tests of registration, login and sessions against a real
 * PostgreSQL database.
 *
 * They run only when TEST_DATABASE_URL is set, for example:
 *   TEST_DATABASE_URL=postgres://trafficflow:<password>@localhost:5432/trafficflow_test
 *
 * WARNING: the test database is wiped (DROP SCHEMA public CASCADE) before the
 * tests run. Its name must contain "test", so it can't be your real database.
 */
loadEnvFile(); // lets TEST_DATABASE_URL live in backend/.env
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

const PASSWORD = 'Passw0rd-for-tests';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe.skipIf(!TEST_DATABASE_URL)('Authentication API with PostgreSQL', () => {
  let pool: Pool;
  let app: Express;

  const register = (body: Record<string, unknown>) => request(app).post('/api/v1/auth/register').send(body);
  const login = (email: string, password: string) => request(app).post('/api/v1/auth/login').send({ email, password });

  /** Registers a user and returns a supertest agent that keeps the session cookie, like a browser. */
  async function loggedInAgent(email: string) {
    await register({ fullName: 'Session Tester', email, password: PASSWORD }).expect(201);
    const agent = request.agent(app);
    await agent.post('/api/v1/auth/login').send({ email, password: PASSWORD }).expect(200);
    return agent;
  }

  async function userCount(): Promise<number> {
    const { rows } = await pool.query<{ count: number }>('SELECT count(*)::int AS count FROM users');
    return rows[0]!.count;
  }

  beforeAll(async () => {
    const databaseName = new URL(TEST_DATABASE_URL!).pathname.slice(1);
    if (!databaseName.includes('test')) {
      throw new Error(`Refusing to wipe "${databaseName}": the test database name must contain "test"`);
    }

    pool = createPool({ url: TEST_DATABASE_URL!, poolMax: 5 });
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await runMigrations(pool);

    // A higher limit for failed attempts, so the tests below never hit the login rate limit
    ({ app } = buildTestApp({
      pool,
      checks: databaseReadinessChecks(pool),
      env: { DATABASE_URL: TEST_DATABASE_URL!, AUTH_RATE_LIMIT_MAX: '100' },
    }));
  });

  afterAll(async () => {
    await pool?.end();
  });

  describe('POST /api/v1/auth/register', () => {
    it('creates a CITIZEN account, logs it in, and never returns the password hash', async () => {
      const res = await register({
        fullName: 'Ayesha Fernando',
        email: 'Ayesha@Test.local',
        phone: '+94 77 123 4567',
        password: PASSWORD,
      }).expect(201);

      expect(res.body).toMatchObject({
        fullName: 'Ayesha Fernando',
        email: 'ayesha@test.local',
        phone: '+94 77 123 4567',
        role: 'CITIZEN',
        isActive: true,
      });
      expect(res.body.id).toMatch(UUID);
      expect(res.body).not.toHaveProperty('passwordHash');
      expect(JSON.stringify(res.body)).not.toContain(PASSWORD);
      expect(String(res.headers['set-cookie'])).toMatch(/tf_session=[^;]+;.*HttpOnly/i);
    });

    it('stores a bcrypt hash in PostgreSQL, never the plain password', async () => {
      const { rows } = await pool.query<{ password_hash: string }>(
        `SELECT password_hash FROM users WHERE email = 'ayesha@test.local'`,
      );

      expect(rows[0]!.password_hash).toMatch(/^\$2[aby]\$\d{2}\$.{53}$/);
      expect(rows[0]!.password_hash).not.toContain(PASSWORD);
    });

    it('always creates a CITIZEN, even when the request asks for another role', async () => {
      for (const role of ['ADMIN', 'OPERATOR', 'RESPONDER']) {
        const res = await register({
          fullName: 'Sneaky User',
          email: `sneaky-${role.toLowerCase()}@test.local`,
          password: PASSWORD,
          role,
        }).expect(201);
        expect(res.body.role).toBe('CITIZEN');
      }

      const { rows } = await pool.query<{ count: number }>(`SELECT count(*)::int AS count FROM users WHERE role <> 'CITIZEN'`);
      expect(rows[0]!.count).toBe(0);
    });

    it('rejects a second account with the same email, even in different case, with 409 EMAIL_TAKEN', async () => {
      const before = await userCount();

      const res = await register({ fullName: 'Someone Else', email: 'AYESHA@test.LOCAL', password: PASSWORD });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatchObject({
        code: 'EMAIL_TAKEN',
        message: 'An account with this email address already exists',
      });
      expect(await userCount()).toBe(before);
    });

    it('rejects invalid data with 400 and lists each invalid field', async () => {
      const before = await userCount();

      const res = await register({ fullName: '', email: 'not-an-email', password: 'short' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      const fields = new Set((res.body.error.details as Array<{ field: string }>).map((detail) => detail.field));
      expect([...fields].sort()).toEqual(['email', 'fullName', 'password']);
      expect(await userCount()).toBe(before);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('logs in with the right password, sets the session cookie and records the login time', async () => {
      const res = await login('ayesha@test.local', PASSWORD).expect(200);

      expect(res.body).toMatchObject({ email: 'ayesha@test.local', role: 'CITIZEN' });
      expect(res.body).not.toHaveProperty('passwordHash');
      expect(String(res.headers['set-cookie'])).toMatch(/tf_session=[^;]+;.*HttpOnly/i);

      const { rows } = await pool.query<{ last_login_at: Date | null }>(
        `SELECT last_login_at FROM users WHERE email = 'ayesha@test.local'`,
      );
      expect(rows[0]!.last_login_at).toBeInstanceOf(Date);
    });

    it('accepts the email in any case', async () => {
      await login('  AYESHA@test.local ', PASSWORD).expect(200);
    });

    it('rejects a wrong password with 401 INVALID_CREDENTIALS and no cookie', async () => {
      const res = await login('ayesha@test.local', 'Wrong-passw0rd');

      expect(res.status).toBe(401);
      expect(res.body.error).toMatchObject({ code: 'INVALID_CREDENTIALS', message: 'Incorrect email or password' });
      expect(res.headers['set-cookie']).toBeUndefined();
    });

    it('gives exactly the same answer for an email that is not registered', async () => {
      const res = await login('nobody@test.local', PASSWORD);

      expect(res.status).toBe(401);
      expect(res.body.error).toMatchObject({ code: 'INVALID_CREDENTIALS', message: 'Incorrect email or password' });
    });

    it('refuses a deactivated account with 403 ACCOUNT_DISABLED', async () => {
      await register({ fullName: 'Former User', email: 'former@test.local', password: PASSWORD }).expect(201);
      await pool.query(`UPDATE users SET is_active = false WHERE email = 'former@test.local'`);

      const res = await login('former@test.local', PASSWORD);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('ACCOUNT_DISABLED');
    });
  });

  describe('sessions and protected routes', () => {
    it('GET /api/v1/auth/me returns the logged-in user', async () => {
      const agent = await loggedInAgent('me@test.local');

      const res = await agent.get('/api/v1/auth/me').expect(200);

      expect(res.body).toMatchObject({ email: 'me@test.local', fullName: 'Session Tester', role: 'CITIZEN' });
      expect(res.body).not.toHaveProperty('passwordHash');
    });

    it('GET /api/v1/protected-test is rejected without a session and allowed with one', async () => {
      const anonymous = await request(app).get('/api/v1/protected-test');
      expect(anonymous.status).toBe(401);
      expect(anonymous.body.error.code).toBe('AUTH_REQUIRED');

      const agent = await loggedInAgent('protected@test.local');
      const res = await agent.get('/api/v1/protected-test').expect(200);

      expect(res.body).toMatchObject({
        message: 'Hello Session Tester, you are authenticated.',
        user: { email: 'protected@test.local', role: 'CITIZEN' },
      });
      expect(res.body.user.id).toMatch(UUID);
    });

    it('logout ends the session: /me and the protected route are rejected afterwards', async () => {
      const agent = await loggedInAgent('logout@test.local');
      await agent.get('/api/v1/protected-test').expect(200);

      const logout = await agent.post('/api/v1/auth/logout');
      expect(logout.status).toBe(204);
      expect(String(logout.headers['set-cookie'])).toMatch(/tf_session=;/);

      expect((await agent.get('/api/v1/protected-test')).status).toBe(401);
      expect((await agent.get('/api/v1/auth/me')).status).toBe(401);
    });

    it('logs out a user on their next request once the account is deactivated', async () => {
      const agent = await loggedInAgent('deactivated@test.local');
      await pool.query(`UPDATE users SET is_active = false WHERE email = 'deactivated@test.local'`);

      const res = await agent.get('/api/v1/protected-test');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('SESSION_EXPIRED');
    });
  });

  it('GET /api/health/ready reports ready: PostgreSQL answers and the users table is migrated', async () => {
    const res = await request(app).get('/api/health/ready').expect(200);

    expect(res.body).toMatchObject({
      status: 'ready',
      checks: { database: { status: 'up' }, migrations: { status: 'up' } },
    });
  });
});
