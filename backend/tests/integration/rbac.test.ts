import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadEnvFile } from '../../src/config/env.js';
import { runMigrations } from '../../src/db/migrate.js';
import { createPool, type Pool } from '../../src/db/pool.js';
import { createPasswordHasher } from '../../src/modules/auth/passwords.js';
import * as users from '../../src/modules/users/users.repository.js';
import type { Role } from '../../src/types/domain.js';
import { buildTestApp } from '../helpers.js';

/**
 * Role-based access control, checked against the real API and PostgreSQL:
 * every role is sent to a representative route of every area, and must be
 * refused (403) exactly where its role isn't allowed. Anonymous requests
 * always get 401.
 *
 * The backend is the security boundary: these tests call the API directly,
 * the same way someone bypassing the web app would.
 */
loadEnvFile();
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

const PASSWORD = 'Passw0rd-for-tests';
const SOME_ID = '5f0c6a3e-8f7b-4c2d-9a1e-3b4c5d6e7f80'; // valid UUID that matches nothing

type Method = 'get' | 'post' | 'patch';
const ROLES: Role[] = ['CITIZEN', 'OPERATOR', 'RESPONDER', 'ADMIN'];

/** [area, method, path, roles allowed] */
const ROUTES: Array<[string, Method, string, Role[]]> = [
  ['any logged-in user', 'get', '/api/v1/auth/me', ROLES],
  ['any logged-in user', 'get', '/api/v1/protected-test', ROLES],
  ['any logged-in user', 'get', '/api/v1/incident-types', ROLES],

  ['citizen', 'post', '/api/v1/incidents', ['CITIZEN']],
  ['citizen', 'get', '/api/v1/incidents/mine', ['CITIZEN']],

  ['operator', 'get', '/api/v1/incidents', ['OPERATOR', 'ADMIN']],
  ['operator', 'get', '/api/v1/incidents/map', ['OPERATOR', 'ADMIN']],
  ['operator', 'get', '/api/v1/stats/dashboard', ['OPERATOR', 'ADMIN']],
  ['operator', 'get', '/api/v1/responders', ['OPERATOR', 'ADMIN']],
  ['operator', 'patch', `/api/v1/incidents/${SOME_ID}/verify`, ['OPERATOR']],
  ['operator', 'patch', `/api/v1/incidents/${SOME_ID}/reject`, ['OPERATOR']],
  ['operator', 'post', `/api/v1/incidents/${SOME_ID}/assignments`, ['OPERATOR']],

  ['responder', 'get', '/api/v1/responder/me', ['RESPONDER']],
  ['responder', 'get', '/api/v1/responder/assignments', ['RESPONDER']],
  ['responder', 'patch', `/api/v1/responder/assignments/${SOME_ID}/respond`, ['RESPONDER']],
  ['responder', 'post', `/api/v1/incidents/${SOME_ID}/notes`, ['RESPONDER', 'OPERATOR']],
  ['responder', 'patch', `/api/v1/incidents/${SOME_ID}/resolve`, ['RESPONDER', 'OPERATOR']],

  ['admin', 'get', '/api/v1/admin/users', ['ADMIN']],
  ['admin', 'post', '/api/v1/admin/users', ['ADMIN']],
  ['admin', 'patch', `/api/v1/admin/responders/${SOME_ID}`, ['ADMIN']],
  ['admin', 'get', '/api/v1/admin/incident-types', ['ADMIN']],
  ['admin', 'post', '/api/v1/admin/incident-types', ['ADMIN']],
  ['admin', 'get', '/api/v1/stats/system', ['ADMIN']],
];

describe.skipIf(!TEST_DATABASE_URL)('Role-based access control with PostgreSQL', () => {
  let pool: Pool;
  let app: Express;
  const agents = new Map<Role, ReturnType<typeof request.agent>>();

  function send(agent: ReturnType<typeof request.agent> | ReturnType<typeof request>, method: Method, path: string) {
    return method === 'get' ? agent.get(path) : method === 'post' ? agent.post(path).send({}) : agent.patch(path).send({});
  }

  beforeAll(async () => {
    const databaseName = new URL(TEST_DATABASE_URL!).pathname.slice(1);
    if (!databaseName.includes('test')) {
      throw new Error(`Refusing to wipe "${databaseName}": the test database name must contain "test"`);
    }

    pool = createPool({ url: TEST_DATABASE_URL!, poolMax: 5 });
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await runMigrations(pool);
    ({ app } = buildTestApp({ pool, env: { DATABASE_URL: TEST_DATABASE_URL!, AUTH_RATE_LIMIT_MAX: '100' } }));

    const hasher = createPasswordHasher(4);
    const passwordHash = await hasher.hash(PASSWORD);
    for (const role of ROLES) {
      const email = `${role.toLowerCase()}@rbac.test`;
      const id = await users.insertUser(pool, { fullName: `Test ${role}`, email, phone: null, passwordHash, role });
      if (role === 'RESPONDER') await users.insertResponderProfile(pool, id, { responderType: 'POLICE', unitCode: 'RBAC-01' });

      const agent = request.agent(app);
      await agent.post('/api/v1/auth/login').send({ email, password: PASSWORD }).expect(200);
      agents.set(role, agent);
    }
  });

  afterAll(async () => {
    await pool?.end();
  });

  it.each(ROUTES)('%s route %s %s: refuses anonymous requests with 401', async (_area, method, path) => {
    const res = await send(request(app), method, path);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_REQUIRED');
  });

  for (const role of ROLES) {
    it(`${role}: allowed exactly on its own routes, 403 FORBIDDEN everywhere else`, async () => {
      const agent = agents.get(role)!;
      const outcomes: string[] = [];

      for (const [, method, path, allowed] of ROUTES) {
        const res = await send(agent, method, path);
        const isAllowed = allowed.includes(role);
        // Allowed requests may still fail validation (400) or find nothing (404), but never 401/403
        const ok = isAllowed ? res.status !== 401 && res.status !== 403 : res.status === 403 && res.body.error.code === 'FORBIDDEN';
        if (!ok) outcomes.push(`${method.toUpperCase()} ${path}: expected ${isAllowed ? 'access' : '403'}, got ${res.status}`);
      }

      expect(outcomes).toEqual([]);
    });
  }

  it('CITIZEN cannot use operator actions, even on an incident they reported', async () => {
    const citizen = agents.get('CITIZEN')!;
    const types = await citizen.get('/api/v1/incident-types').expect(200);
    const report = await citizen
      .post('/api/v1/incidents')
      .field('incidentTypeId', types.body.items[0].id)
      .field('description', 'Fallen tree blocking both lanes')
      .field('latitude', '6.9')
      .field('longitude', '79.86')
      .expect(201);

    const verify = await citizen.patch(`/api/v1/incidents/${report.body.id}/verify`).send({ severity: 'LOW' });
    expect(verify.status).toBe(403);

    const detail = await citizen.get(`/api/v1/incidents/${report.body.id}`).expect(200);
    expect(detail.body.status).toBe('REPORTED');
  });

  it('ADMIN can manage users and incident types', async () => {
    const admin = agents.get('ADMIN')!;

    const created = await admin
      .post('/api/v1/admin/users')
      .send({ fullName: 'New Operator', email: 'new.operator@rbac.test', password: PASSWORD, role: 'OPERATOR' })
      .expect(201);
    expect(created.body.role).toBe('OPERATOR');

    await admin.patch(`/api/v1/admin/users/${created.body.id}`).send({ isActive: false }).expect(200);
    const login = await request(app).post('/api/v1/auth/login').send({ email: 'new.operator@rbac.test', password: PASSWORD });
    expect(login.status).toBe(403);

    const type = await admin
      .post('/api/v1/admin/incident-types')
      .send({ code: 'LANDSLIDE', name: 'Landslide' })
      .expect(201);
    expect(type.body).toMatchObject({ code: 'LANDSLIDE', isActive: true });
  });
});
