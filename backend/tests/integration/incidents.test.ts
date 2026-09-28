import { readdir } from 'node:fs/promises';
import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadEnvFile } from '../../src/config/env.js';
import { runMigrations } from '../../src/db/migrate.js';
import { createPool, type Pool } from '../../src/db/pool.js';
import { createPasswordHasher } from '../../src/modules/auth/passwords.js';
import * as users from '../../src/modules/users/users.repository.js';
import type { ResponderType, Role } from '../../src/types/domain.js';

type HistoryRow = { fromStatus: string | null; toStatus: string; note: string | null };
import { buildTestApp, TEST_ENV } from '../helpers.js';

/**
 * End-to-end API tests against a real PostgreSQL database.
 *
 * They run only when TEST_DATABASE_URL is set, for example:
 *   TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/trafficflow_test
 *
 * WARNING: the test database is wiped (DROP SCHEMA public CASCADE) before the
 * tests run. Its name must contain "test", so it can't be your real database.
 */
loadEnvFile(); // lets TEST_DATABASE_URL live in backend/.env
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

const PASSWORD = 'Passw0rd-for-tests';

// A valid 1x1 PNG image
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

describe.skipIf(!TEST_DATABASE_URL)('TrafficFlow API with PostgreSQL', () => {
  let pool: Pool;
  let app: Express;
  const ids: Record<string, string> = {};

  async function createAccount(key: string, role: Role, responder?: { responderType: ResponderType; unitCode: string }) {
    const hasher = createPasswordHasher(4);
    const id = await users.insertUser(pool, {
      fullName: `Test ${key}`,
      email: `${key}@test.local`,
      phone: '+94 77 000 0000',
      passwordHash: await hasher.hash(PASSWORD),
      role,
    });
    if (responder) await users.insertResponderProfile(pool, id, responder);
    ids[key] = id;
  }

  /** A supertest agent that keeps the session cookie, like a browser. */
  async function loginAs(key: string) {
    const agent = request.agent(app);
    await agent.post('/api/v1/auth/login').send({ email: `${key}@test.local`, password: PASSWORD }).expect(200);
    return agent;
  }

  async function reportIncident(agent: ReturnType<typeof request.agent>, typeCode = 'ACCIDENT') {
    const types = await agent.get('/api/v1/incident-types').expect(200);
    const type = (types.body.items as Array<{ id: string; code: string }>).find((t) => t.code === typeCode)!;
    const res = await agent
      .post('/api/v1/incidents')
      .field('incidentTypeId', type.id)
      .field('title', 'Collision at the junction')
      .field('description', 'Two cars collided at the junction, one driver injured')
      .field('latitude', '6.9271')
      .field('longitude', '79.8612')
      .field('locationText', 'Galle Road')
      .expect(201);
    return res.body as { id: string; referenceNo: string; status: string };
  }

  beforeAll(async () => {
    const databaseName = new URL(TEST_DATABASE_URL!).pathname.slice(1);
    if (!databaseName.includes('test')) {
      throw new Error(`Refusing to wipe "${databaseName}": the test database name must contain "test"`);
    }

    pool = createPool({ url: TEST_DATABASE_URL!, poolMax: 5 });
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await runMigrations(pool);
    ({ app } = buildTestApp({ pool, env: { DATABASE_URL: TEST_DATABASE_URL! } }));

    await createAccount('admin', 'ADMIN');
    await createAccount('operator', 'OPERATOR');
    await createAccount('ambulance', 'RESPONDER', { responderType: 'AMBULANCE', unitCode: 'AMB-01' });
    await createAccount('police', 'RESPONDER', { responderType: 'POLICE', unitCode: 'POL-01' });
    await createAccount('fire', 'RESPONDER', { responderType: 'FIRE', unitCode: 'FIRE-01' });
    await createAccount('other', 'CITIZEN');
  });

  afterAll(async () => {
    await pool?.end();
  });

  describe('accounts', () => {
    it('registers a citizen, ignoring any role sent by the client, and logs them in', async () => {
      const agent = request.agent(app);

      const res = await agent
        .post('/api/v1/auth/register')
        .send({ fullName: 'Ayesha Fernando', email: 'Citizen@Test.local', password: PASSWORD, role: 'ADMIN' })
        .expect(201);

      expect(res.body).toMatchObject({ fullName: 'Ayesha Fernando', email: 'citizen@test.local', role: 'CITIZEN' });
      expect(res.body.passwordHash).toBeUndefined();
      expect(String(res.headers['set-cookie'])).toMatch(/tf_session=.+HttpOnly/i);

      const me = await agent.get('/api/v1/auth/me').expect(200);
      expect(me.body.role).toBe('CITIZEN');
      ids.citizen = me.body.id;
    });

    it('rejects a second account with the same email in different case', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ fullName: 'Someone Else', email: 'CITIZEN@test.local', password: PASSWORD });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('EMAIL_TAKEN');
    });

    it('gives the same answer for a wrong password and an unknown email', async () => {
      const wrongPassword = await request(app).post('/api/v1/auth/login').send({ email: 'citizen@test.local', password: 'nope1234' });
      const unknownEmail = await request(app).post('/api/v1/auth/login').send({ email: 'nobody@test.local', password: 'nope1234' });

      for (const res of [wrongPassword, unknownEmail]) {
        expect(res.status).toBe(401);
        expect(res.body.error).toMatchObject({ code: 'INVALID_CREDENTIALS', message: 'Incorrect email or password' });
      }
    });
  });

  describe('incident lifecycle with several responders', () => {
    let incidentId: string;
    let ambulanceAssignment: string;
    let policeAssignment: string;

    it('lets a citizen report an incident with a photo', async () => {
      const citizen = await loginAs('citizen');
      const types = await citizen.get('/api/v1/incident-types').expect(200);
      expect(types.body.items).toHaveLength(7);
      const accident = (types.body.items as Array<{ id: string; code: string }>).find((t) => t.code === 'ACCIDENT')!;

      const res = await citizen
        .post('/api/v1/incidents')
        .field('incidentTypeId', accident.id)
        .field('title', 'Two-car collision at the junction')
        .field('description', 'Two cars collided at the junction, one driver injured')
        .field('latitude', '6.9271')
        .field('longitude', '79.8612')
        .field('severity', 'HIGH')
        .attach('image', PNG, { filename: 'crash.png', contentType: 'image/png' })
        .expect(201);

      expect(res.body).toMatchObject({
        title: 'Two-car collision at the junction',
        status: 'REPORTED',
        severity: 'HIGH', // the citizen's own estimate
        hasImage: true,
        latitude: 6.9271,
        longitude: 79.8612,
      });
      expect(res.body.referenceNo).toMatch(/^TF-\d{6}$/);
      expect(res.body.history).toHaveLength(1);
      expect(res.body.history[0]).toMatchObject({ fromStatus: null, toStatus: 'REPORTED' });
      incidentId = res.body.id;

      const photo = await citizen.get(`/api/v1/incidents/${incidentId}/image`).expect(200);
      expect(photo.headers['content-type']).toBe('image/png');
    });

    it('rejects a file that only pretends to be an image, and deletes it', async () => {
      const citizen = await loginAs('citizen');
      const filesBefore = await readdir(TEST_ENV.UPLOAD_DIR);
      const types = await citizen.get('/api/v1/incident-types');

      const res = await citizen
        .post('/api/v1/incidents')
        .field('incidentTypeId', types.body.items[0].id)
        .field('title', 'Not really a photo')
        .field('description', 'Trying to upload a script as an image')
        .field('latitude', '6.9')
        .field('longitude', '79.8')
        .attach('image', Buffer.from('<script>alert(1)</script>'), { filename: 'x.png', contentType: 'image/png' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_FILE_TYPE');
      expect(await readdir(TEST_ENV.UPLOAD_DIR)).toHaveLength(filesBefore.length);
    });

    it('hides the incident and its photo from other citizens', async () => {
      const other = await loginAs('other');

      expect((await other.get(`/api/v1/incidents/${incidentId}`)).status).toBe(404);
      expect((await other.get(`/api/v1/incidents/${incidentId}/image`)).status).toBe(404);
      // The list only contains the incidents a citizen may see: their own
      const list = await other.get('/api/v1/incidents').expect(200);
      expect(list.body.items.map((i: { id: string }) => i.id)).not.toContain(incidentId);
      expect((await other.patch(`/api/v1/incidents/${incidentId}/verify`).send({ severity: 'LOW' })).status).toBe(403);
    });

    it('lets operators find the incident by status and reference number', async () => {
      const operator = await loginAs('operator');
      const detail = await operator.get(`/api/v1/incidents/${incidentId}`).expect(200);

      const byStatus = await operator.get('/api/v1/incidents?status=REPORTED').expect(200);
      const bySearch = await operator.get(`/api/v1/incidents?search=${detail.body.referenceNo}`).expect(200);
      const map = await operator.get('/api/v1/incidents/map').expect(200);

      expect(byStatus.body.items.map((i: { id: string }) => i.id)).toContain(incidentId);
      expect(bySearch.body.pagination.total).toBe(1);
      expect(map.body.items.map((i: { id: string }) => i.id)).toContain(incidentId);
    });

    it('requires verification before responders can be assigned', async () => {
      const operator = await loginAs('operator');

      const res = await operator.post(`/api/v1/incidents/${incidentId}/assignments`).send({ responderIds: [ids.ambulance] });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INCIDENT_NOT_VERIFIED');
    });

    it('verifies the incident once, and the operator decides the final severity', async () => {
      const operator = await loginAs('operator');

      const res = await operator.patch(`/api/v1/incidents/${incidentId}/verify`).send({ severity: 'CRITICAL' }).expect(200);
      expect(res.body).toMatchObject({ status: 'VERIFIED', severity: 'CRITICAL', reviewedBy: { id: ids.operator } });

      const again = await operator.patch(`/api/v1/incidents/${incidentId}/verify`).send({ severity: 'LOW' });
      expect(again.status).toBe(409);
      expect(again.body.error.code).toBe('INVALID_STATUS_TRANSITION');
    });

    it('assigns an ambulance and the police together', async () => {
      const operator = await loginAs('operator');

      const res = await operator
        .post(`/api/v1/incidents/${incidentId}/assignments`)
        .send({ responderIds: [ids.ambulance, ids.police], notes: 'Injured driver' })
        .expect(200);

      expect(res.body.status).toBe('ASSIGNED');
      expect(res.body.assignments).toHaveLength(2);
      ambulanceAssignment = res.body.assignments.find((a: { responder: { id: string } }) => a.responder.id === ids.ambulance).id;
      policeAssignment = res.body.assignments.find((a: { responder: { id: string } }) => a.responder.id === ids.police).id;

      const responders = await operator.get('/api/v1/responders?availability=BUSY').expect(200);
      expect(responders.body.items.map((r: { unitCode: string }) => r.unitCode).sort()).toEqual(['AMB-01', 'POL-01']);
    });

    it('refuses to assign the same responder twice', async () => {
      const operator = await loginAs('operator');

      const res = await operator.post(`/api/v1/incidents/${incidentId}/assignments`).send({ responderIds: [ids.ambulance] });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ALREADY_ASSIGNED');
    });

    it('hides the incident from responders who are not assigned', async () => {
      const fire = await loginAs('fire');
      expect((await fire.get(`/api/v1/incidents/${incidentId}`)).status).toBe(404);
    });

    it('lets a responder accept their assignment, which is noted in the timeline', async () => {
      const ambulance = await loginAs('ambulance');
      const police = await loginAs('police');
      const mine = await ambulance.get('/api/v1/responder/assignments').expect(200);
      expect(mine.body.items).toHaveLength(1);
      expect(mine.body.items[0]).toMatchObject({ status: 'ASSIGNED', incident: { id: incidentId, title: 'Two-car collision at the junction' } });

      // Nobody else can accept it
      expect((await police.patch(`/api/v1/responder/assignments/${ambulanceAssignment}/accept`)).status).toBe(404);

      const res = await ambulance.patch(`/api/v1/responder/assignments/${ambulanceAssignment}/accept`).expect(200);
      const row = res.body.assignments.find((a: { id: string }) => a.id === ambulanceAssignment);
      expect(row.status).toBe('ACCEPTED');
      expect(row.acceptedAt).toBeTruthy();
      expect(res.body.status).toBe('ASSIGNED'); // accepting doesn't change the incident's status
      expect(res.body.history.at(-1)).toMatchObject({ fromStatus: 'ASSIGNED', toStatus: 'ASSIGNED', note: 'AMB-01 accepted the assignment' });

      const again = await ambulance.patch(`/api/v1/responder/assignments/${ambulanceAssignment}/accept`);
      expect(again.status).toBe(409);
      expect(again.body.error.code).toBe('ASSIGNMENT_NOT_PENDING');
    });

    it('moves the incident to RESPONDING when the first responder starts', async () => {
      const ambulance = await loginAs('ambulance');

      const res = await ambulance.patch(`/api/v1/responder/assignments/${ambulanceAssignment}/respond`).expect(200);
      expect(res.body.status).toBe('RESPONDING');

      const again = await ambulance.patch(`/api/v1/responder/assignments/${ambulanceAssignment}/respond`);
      expect(again.status).toBe(409);
    });

    it('lets the assigned responder and operators add notes without changing the status', async () => {
      const ambulance = await loginAs('ambulance');
      const operator = await loginAs('operator');

      const res = await ambulance
        .post(`/api/v1/incidents/${incidentId}/notes`)
        .send({ note: 'Arrived on scene, one lane closed' })
        .expect(201);
      expect(res.body.status).toBe('RESPONDING');
      expect(res.body.history.at(-1)).toMatchObject({
        fromStatus: 'RESPONDING',
        toStatus: 'RESPONDING',
        note: 'Arrived on scene, one lane closed',
        changedBy: { id: ids.ambulance, role: 'RESPONDER' },
      });

      await operator.post(`/api/v1/incidents/${incidentId}/notes`).send({ note: 'Traffic diverted via Duplication Road' }).expect(201);
    });

    it('does not let unassigned responders or citizens add notes', async () => {
      const fire = await loginAs('fire');
      const citizen = await loginAs('citizen');

      expect((await fire.post(`/api/v1/incidents/${incidentId}/notes`).send({ note: 'Not my incident' })).status).toBe(404);
      expect((await citizen.post(`/api/v1/incidents/${incidentId}/notes`).send({ note: 'Any update?' })).status).toBe(403);
      const empty = await (await loginAs('ambulance')).post(`/api/v1/incidents/${incidentId}/notes`).send({ note: ' ' });
      expect(empty.status).toBe(400);
    });

    it('lets operators cancel an assignment that has not started, but not one that is responding', async () => {
      const operator = await loginAs('operator');

      const cancelled = await operator
        .patch(`/api/v1/incidents/${incidentId}/assignments/${policeAssignment}/cancel`)
        .expect(200);
      expect(cancelled.body.assignments.find((a: { id: string }) => a.id === policeAssignment).status).toBe('CANCELLED');

      const responding = await operator.patch(`/api/v1/incidents/${incidentId}/assignments/${ambulanceAssignment}/cancel`);
      expect(responding.status).toBe(409);
      expect(responding.body.error.code).toBe('ASSIGNMENT_NOT_CANCELLABLE');

      const police = await operator.get('/api/v1/responders?type=POLICE').expect(200);
      expect(police.body.items[0].availability).toBe('AVAILABLE');
    });

    it('does not let a cancelled responder resolve the incident or add notes', async () => {
      const police = await loginAs('police');
      const res = await police.patch(`/api/v1/incidents/${incidentId}/resolve`).send({ resolutionNotes: 'Done here' });
      expect(res.status).toBe(404);

      // After cancellation the incident is no longer theirs: it is hidden, like any other incident
      const note = await police.post(`/api/v1/incidents/${incidentId}/notes`).send({ note: 'Still here' });
      expect(note.status).toBe(404);
    });

    it('lets the responding responder resolve it, completing the assignments', async () => {
      const ambulance = await loginAs('ambulance');

      const res = await ambulance
        .patch(`/api/v1/incidents/${incidentId}/resolve`)
        .send({ resolutionNotes: 'Driver taken to hospital, road cleared' })
        .expect(200);

      expect(res.body.status).toBe('RESOLVED');
      expect(res.body.resolvedAt).toBeTruthy();
      // The status changes, in order (notes keep the status, so they are left out here)
      const changes = (res.body.history as Array<{ fromStatus: string | null; toStatus: string }>).filter(
        (h) => h.fromStatus !== h.toStatus,
      );
      expect(changes.map((h) => h.toStatus)).toEqual([
        'REPORTED',
        'VERIFIED',
        'ASSIGNED',
        'RESPONDING',
        'RESOLVED',
      ]);
      const ambulanceRow = res.body.assignments.find((a: { id: string }) => a.id === ambulanceAssignment);
      expect(ambulanceRow.status).toBe('COMPLETED');

      const profile = await ambulance.get('/api/v1/responder/me').expect(200);
      expect(profile.body.availability).toBe('AVAILABLE');

      const lateNote = await ambulance.post(`/api/v1/incidents/${incidentId}/notes`).send({ note: 'One more thing' });
      expect(lateNote.status).toBe(409);
      expect(lateNote.body.error.code).toBe('INCIDENT_CLOSED');
    });

    it('shows the citizen the resolved incident and its timeline', async () => {
      const citizen = await loginAs('citizen');

      const mine = await citizen.get('/api/v1/incidents/mine').expect(200);
      const detail = await citizen.get(`/api/v1/incidents/${incidentId}`).expect(200);

      expect(mine.body.items.map((i: { id: string }) => i.id)).toContain(incidentId);
      expect(detail.body).toMatchObject({ status: 'RESOLVED', resolutionNotes: 'Driver taken to hospital, road cleared' });
      expect(detail.body.history.map((h: { note: string | null }) => h.note)).toContain('Arrived on scene, one lane closed');
    });
  });

  describe('other business rules', () => {
    it('does not let the last responder be cancelled', async () => {
      const citizen = await loginAs('citizen');
      const operator = await loginAs('operator');
      const incident = await reportIncident(citizen);
      await operator.patch(`/api/v1/incidents/${incident.id}/verify`).send({ severity: 'LOW' }).expect(200);
      const assigned = await operator
        .post(`/api/v1/incidents/${incident.id}/assignments`)
        .send({ responderIds: [ids.police] })
        .expect(200);

      const res = await operator.patch(`/api/v1/incidents/${incident.id}/assignments/${assigned.body.assignments[0].id}/cancel`);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('LAST_ASSIGNMENT');
    });

    it('rejects a report with a reason the citizen can see', async () => {
      const citizen = await loginAs('citizen');
      const operator = await loginAs('operator');
      const incident = await reportIncident(citizen, 'OTHER');

      await operator.patch(`/api/v1/incidents/${incident.id}/reject`).send({ reason: 'Not a traffic incident' }).expect(200);
      const seen = await citizen.get(`/api/v1/incidents/${incident.id}`).expect(200);

      expect(seen.body).toMatchObject({ status: 'REJECTED', rejectionReason: 'Not a traffic incident' });
      const assign = await operator.post(`/api/v1/incidents/${incident.id}/assignments`).send({ responderIds: [ids.fire] });
      expect(assign.body.error.code).toBe('INCIDENT_CLOSED');
    });

    it('does not assign responders who are off duty', async () => {
      const fire = await loginAs('fire');
      const citizen = await loginAs('citizen');
      const operator = await loginAs('operator');
      await fire.patch('/api/v1/responder/me/availability').send({ availability: 'OFF_DUTY' }).expect(200);
      const incident = await reportIncident(citizen, 'FIRE');
      await operator.patch(`/api/v1/incidents/${incident.id}/verify`).send({ severity: 'CRITICAL' }).expect(200);

      const res = await operator.post(`/api/v1/incidents/${incident.id}/assignments`).send({ responderIds: [ids.fire] });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('RESPONDER_OFF_DUTY');
      await fire.patch('/api/v1/responder/me/availability').send({ availability: 'AVAILABLE' }).expect(200);
    });
  });

  describe('statistics', () => {
    it('gives operators a dashboard that matches the data', async () => {
      const operator = await loginAs('operator');

      const res = await operator.get('/api/v1/stats/dashboard').expect(200);

      expect(res.body.incidentsByStatus).toMatchObject({ RESOLVED: 1, REJECTED: 1, ASSIGNED: 1, VERIFIED: 1 });
      expect(res.body.openIncidents).toBe(2);
      expect(res.body.last7Days).toHaveLength(7);
      expect(res.body.averageResolutionMinutes).toBeTypeOf('number');
      expect(res.body.respondersByAvailability).toMatchObject({ AVAILABLE: 2, BUSY: 1, OFF_DUTY: 0 });
    });

    it('keeps system statistics for admins only', async () => {
      const operator = await loginAs('operator');
      const admin = await loginAs('admin');

      expect((await operator.get('/api/v1/stats/system')).status).toBe(403);
      const res = await admin.get('/api/v1/stats/system').expect(200);
      expect(res.body.users.byRole).toMatchObject({ ADMIN: 1, OPERATOR: 1, RESPONDER: 3, CITIZEN: 2 });
    });
  });

  describe('administration', () => {
    it('creates a responder with a profile and refuses duplicate unit codes', async () => {
      const admin = await loginAs('admin');
      const responder = {
        fullName: 'New Tow Truck',
        email: 'tow@test.local',
        password: PASSWORD,
        role: 'RESPONDER',
        responderProfile: { responderType: 'TOW', unitCode: 'tow-9', vehicleRegistration: 'WP LK-2276' },
      };

      const created = await admin.post('/api/v1/admin/users').send(responder).expect(201);
      expect(created.body.responderProfile).toMatchObject({
        responderType: 'TOW',
        unitCode: 'TOW-9',
        availability: 'AVAILABLE',
        vehicleRegistration: 'WP LK-2276',
        vehicleDescription: null,
      });
      ids.tow = created.body.id;

      const duplicate = await admin.post('/api/v1/admin/users').send({ ...responder, email: 'tow2@test.local' });
      expect(duplicate.status).toBe(409);
      expect(duplicate.body.error.code).toBe('UNIT_CODE_TAKEN');
    });

    it('records the unit’s vehicle, and lets admins change or clear it', async () => {
      const admin = await loginAs('admin');

      const described = await admin
        .patch(`/api/v1/admin/responders/${ids.tow}`)
        .send({ vehicleDescription: 'Isuzu flatbed tow truck' })
        .expect(200);
      expect(described.body).toMatchObject({ vehicleRegistration: 'WP LK-2276', vehicleDescription: 'Isuzu flatbed tow truck' });

      const cleared = await admin.patch(`/api/v1/admin/responders/${ids.tow}`).send({ vehicleRegistration: null }).expect(200);
      expect(cleared.body).toMatchObject({ vehicleRegistration: null, vehicleDescription: 'Isuzu flatbed tow truck' });

      const tooLong = await admin.patch(`/api/v1/admin/responders/${ids.tow}`).send({ vehicleRegistration: 'X'.repeat(21) });
      expect(tooLong.status).toBe(400);
    });

    it('stops admins from locking themselves out', async () => {
      const admin = await loginAs('admin');

      const res = await admin.patch(`/api/v1/admin/users/${ids.admin}`).send({ isActive: false });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CANNOT_CHANGE_OWN_ACCESS');
    });

    it('ends a deactivated user’s session immediately and blocks new logins', async () => {
      const admin = await loginAs('admin');
      const other = await loginAs('other');

      await admin.patch(`/api/v1/admin/users/${ids.other}`).send({ isActive: false }).expect(200);

      expect((await other.get('/api/v1/auth/me')).status).toBe(401);
      const login = await request(app).post('/api/v1/auth/login').send({ email: 'other@test.local', password: PASSWORD });
      expect(login.status).toBe(403);
      expect(login.body.error.code).toBe('ACCOUNT_DISABLED');
    });

    it('manages incident types without deleting them', async () => {
      const admin = await loginAs('admin');
      const citizen = await loginAs('citizen');

      const created = await admin
        .post('/api/v1/admin/incident-types')
        .send({ code: 'oil_spill', name: 'Oil spill', defaultSeverity: 'MEDIUM' })
        .expect(201);
      expect(created.body).toMatchObject({ code: 'OIL_SPILL', defaultSeverity: 'MEDIUM' });

      const noDefault = await admin
        .patch(`/api/v1/admin/incident-types/${created.body.id}`)
        .send({ defaultSeverity: null })
        .expect(200);
      expect(noDefault.body).toMatchObject({ name: 'Oil spill', defaultSeverity: null });

      await admin.patch(`/api/v1/admin/incident-types/${created.body.id}`).send({ isActive: false }).expect(200);
      const active = await citizen.get('/api/v1/incident-types').expect(200);
      expect(active.body.items.map((t: { code: string }) => t.code)).not.toContain('OIL_SPILL');
    });
  });

  describe('editing incidents, and changing status with POST /incidents/:id/status', () => {
    let incidentId: string;

    beforeAll(async () => {
      await createAccount('neighbour', 'CITIZEN');
    });

    it('scopes GET /incidents: citizens see their own reports, responders their assignments, operators everything', async () => {
      const citizen = await loginAs('citizen');
      const neighbour = await loginAs('neighbour');
      const police = await loginAs('police');
      const operator = await loginAs('operator');

      const own = await citizen.get('/api/v1/incidents').expect(200);
      expect(own.body.pagination.total).toBeGreaterThan(0);
      expect(own.body.items.every((i: { reportedBy: { id: string } }) => i.reportedBy.id === ids.citizen)).toBe(true);
      expect((await neighbour.get('/api/v1/incidents').expect(200)).body.items).toEqual([]);

      // The police unit's first assignment was cancelled; only the incident it still works on is listed
      const assigned = await police.get('/api/v1/incidents').expect(200);
      expect(assigned.body.pagination.total).toBe(1);
      expect(assigned.body.items[0].status).toBe('ASSIGNED');

      const all = await operator.get('/api/v1/incidents').expect(200);
      expect(all.body.pagination.total).toBe(own.body.pagination.total);
    });

    it('lets a citizen correct their own report until it is reviewed', async () => {
      const citizen = await loginAs('citizen');
      const neighbour = await loginAs('neighbour');
      const police = await loginAs('police');
      incidentId = (await reportIncident(citizen)).id;

      const res = await citizen
        .patch(`/api/v1/incidents/${incidentId}`)
        .send({ title: 'Three-car collision at the junction', locationText: 'Galle Road, Kollupitiya' })
        .expect(200);
      expect(res.body).toMatchObject({ title: 'Three-car collision at the junction', locationText: 'Galle Road, Kollupitiya' });
      expect(res.body.history.at(-1)).toMatchObject({
        fromStatus: 'REPORTED',
        toStatus: 'REPORTED',
        note: 'Details updated: title, location description',
      });

      // Sending the same values again changes nothing and adds no timeline entry
      const same = await citizen.patch(`/api/v1/incidents/${incidentId}`).send({ title: 'Three-car collision at the junction' });
      expect(same.body.history).toHaveLength(res.body.history.length);

      expect((await neighbour.patch(`/api/v1/incidents/${incidentId}`).send({ title: 'Not my report' })).status).toBe(404);
      expect((await police.patch(`/api/v1/incidents/${incidentId}`).send({ title: 'Responder edit' })).status).toBe(403);

      const halfLocation = await citizen.patch(`/api/v1/incidents/${incidentId}`).send({ latitude: 6.9 });
      expect(halfLocation.status).toBe(400);
      expect(halfLocation.body.error.details[0].field).toBe('longitude');
      expect((await citizen.patch(`/api/v1/incidents/${incidentId}`).send({})).status).toBe(400);
    });

    it('verifies through POST /status, after which only operators can correct the details', async () => {
      const operator = await loginAs('operator');
      const citizen = await loginAs('citizen');

      expect((await operator.post(`/api/v1/incidents/${incidentId}/status`).send({ status: 'VERIFIED' })).status).toBe(400);
      expect((await operator.post(`/api/v1/incidents/${incidentId}/status`).send({ status: 'CLOSED' })).status).toBe(400);

      const res = await operator
        .post(`/api/v1/incidents/${incidentId}/status`)
        .send({ status: 'VERIFIED', severity: 'MEDIUM' })
        .expect(200);
      expect(res.body).toMatchObject({ status: 'VERIFIED', severity: 'MEDIUM', reviewedBy: { id: ids.operator } });

      const late = await citizen.patch(`/api/v1/incidents/${incidentId}`).send({ title: 'Changed my mind' });
      expect(late.status).toBe(409);
      expect(late.body.error.code).toBe('ALREADY_REVIEWED');

      const corrected = await operator.patch(`/api/v1/incidents/${incidentId}`).send({ severity: 'HIGH' }).expect(200);
      expect(corrected.body.severity).toBe('HIGH');
      expect(corrected.body.history.at(-1).note).toBe('Details updated: severity (MEDIUM → HIGH)');
    });

    it('refuses status changes that the role or the lifecycle does not allow', async () => {
      const citizen = await loginAs('citizen');
      const admin = await loginAs('admin');
      const fire = await loginAs('fire');
      const operator = await loginAs('operator');
      const url = `/api/v1/incidents/${incidentId}/status`;

      expect((await citizen.post(url).send({ status: 'RESOLVED', resolutionNotes: 'Fixed it myself' })).status).toBe(403);
      expect((await admin.post(url).send({ status: 'REJECTED', reason: 'Admins do not review' })).status).toBe(403);

      const verify = await fire.post(url).send({ status: 'VERIFIED', severity: 'LOW' });
      expect(verify.status).toBe(403);
      expect(verify.body.error.code).toBe('TRANSITION_NOT_ALLOWED');

      // A responder who isn't assigned can't even see the incident
      expect((await fire.post(url).send({ status: 'RESPONDING' })).status).toBe(404);

      // VERIFIED → RESOLVED would skip the response
      const skip = await operator.post(url).send({ status: 'RESOLVED', resolutionNotes: 'Closing it early' });
      expect(skip.status).toBe(409);
      expect(skip.body.error.code).toBe('INVALID_STATUS_TRANSITION');
    });

    it('assigns, accepts, responds and resolves, recording every status change in the history table', async () => {
      const operator = await loginAs('operator');
      const fire = await loginAs('fire');
      const url = `/api/v1/incidents/${incidentId}/status`;

      const assigned = await operator
        .post(url)
        .send({ status: 'ASSIGNED', responderIds: [ids.fire], notes: 'Check for fuel leaks' })
        .expect(200);
      expect(assigned.body.status).toBe('ASSIGNED');
      const assignmentId = assigned.body.assignments[0].id as string;

      // As a status change, ASSIGNED only follows VERIFIED (more responders go through /assign)
      const again = await operator.post(url).send({ status: 'ASSIGNED', responderIds: [ids.ambulance] });
      expect(again.status).toBe(409);
      expect(again.body.error.code).toBe('INVALID_STATUS_TRANSITION');

      await fire.patch(`/api/v1/responder/assignments/${assignmentId}/accept`).expect(200);

      const responding = await fire.post(url).send({ status: 'RESPONDING' }).expect(200);
      expect(responding.body.status).toBe('RESPONDING');
      const twice = await fire.post(url).send({ status: 'RESPONDING' });
      expect(twice.status).toBe(409);
      expect(twice.body.error.code).toBe('ALREADY_RESPONDING');

      const resolved = await fire.post(url).send({ status: 'RESOLVED', resolutionNotes: 'Vehicles removed, road open' }).expect(200);
      expect(resolved.body).toMatchObject({ status: 'RESOLVED', resolutionNotes: 'Vehicles removed, road open' });
      expect(resolved.body.assignments[0]).toMatchObject({ status: 'COMPLETED' });

      const statusChanges = (resolved.body.history as HistoryRow[]).filter((h) => h.fromStatus !== h.toStatus);
      expect(statusChanges.map((h) => [h.fromStatus, h.toStatus])).toEqual([
        [null, 'REPORTED'],
        ['REPORTED', 'VERIFIED'],
        ['VERIFIED', 'ASSIGNED'],
        ['ASSIGNED', 'RESPONDING'],
        ['RESPONDING', 'RESOLVED'],
      ]);

      // The same rows are in PostgreSQL, each with who made the change
      const { rows } = await pool.query<{ to_status: string; changed_by: string }>(
        `SELECT to_status, changed_by FROM incident_status_history
         WHERE incident_id = $1 AND from_status IS DISTINCT FROM to_status ORDER BY created_at`,
        [incidentId],
      );
      expect(rows.map((row) => row.changed_by)).toEqual([ids.citizen, ids.operator, ids.operator, ids.fire, ids.fire]);

      const closed = await operator.patch(`/api/v1/incidents/${incidentId}`).send({ title: 'Too late to edit this' });
      expect(closed.status).toBe(409);
      expect(closed.body.error.code).toBe('INCIDENT_CLOSED');
    });

    it('also accepts POST for verify, reject and assign', async () => {
      const citizen = await loginAs('citizen');
      const operator = await loginAs('operator');

      const hazard = await reportIncident(citizen, 'HAZARD');
      await operator.post(`/api/v1/incidents/${hazard.id}/verify`).send({ severity: 'LOW' }).expect(200);
      const assigned = await operator
        .post(`/api/v1/incidents/${hazard.id}/assign`)
        .send({ responderIds: [ids.ambulance] })
        .expect(200);
      expect(assigned.body.status).toBe('ASSIGNED');

      const duplicate = await reportIncident(citizen, 'OTHER');
      const rejected = await operator
        .post(`/api/v1/incidents/${duplicate.id}/reject`)
        .send({ reason: 'Duplicate of an earlier report' })
        .expect(200);
      expect(rejected.body.status).toBe('REJECTED');
    });
  });
});
