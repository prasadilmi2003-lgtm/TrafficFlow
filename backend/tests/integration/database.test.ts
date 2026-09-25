import { cp, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadEnvFile } from '../../src/config/env.js';
import { DEFAULT_MIGRATIONS_DIR, getMigrationStatus, runMigrations } from '../../src/db/migrate.js';
import { createPool, type Pool } from '../../src/db/pool.js';
import { databaseReadinessChecks } from '../../src/db/readiness.js';
import { buildTestApp } from '../helpers.js';

/**
 * Tests for the database foundation against a real PostgreSQL database:
 * the migration runner, the readiness check, and the constraints that
 * protect the data.
 *
 * Like api.test.ts, they run only when TEST_DATABASE_URL is set, and the
 * test database is wiped first (its name must contain "test").
 */
loadEnvFile(); // lets TEST_DATABASE_URL live in backend/.env
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

const TABLES = [
  'incident_assignments',
  'incident_status_history',
  'incident_types',
  'incidents',
  'responder_profiles',
  'schema_migrations',
  'users',
];

describe.skipIf(!TEST_DATABASE_URL)('Database foundation with PostgreSQL', () => {
  let pool: Pool;
  let scratch: string;

  /** A copy of database/migrations that a test is allowed to change. */
  async function copyOfMigrations(): Promise<string> {
    const directory = await mkdtemp(join(scratch, 'migrations-'));
    await cp(DEFAULT_MIGRATIONS_DIR, directory, { recursive: true });
    return directory;
  }

  async function readiness(migrationsDir?: string) {
    const { app } = buildTestApp({ pool, checks: databaseReadinessChecks(pool, migrationsDir) });
    return request(app).get('/api/health/ready');
  }

  beforeAll(async () => {
    const databaseName = new URL(TEST_DATABASE_URL!).pathname.slice(1);
    if (!databaseName.includes('test')) {
      throw new Error(`Refusing to wipe "${databaseName}": the test database name must contain "test"`);
    }

    pool = createPool({ url: TEST_DATABASE_URL!, poolMax: 5 });
    scratch = await mkdtemp(join(tmpdir(), 'trafficflow-db-test-'));
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  });

  afterAll(async () => {
    await pool?.end();
    if (scratch) await rm(scratch, { recursive: true, force: true });
  });

  describe('migrations', () => {
    it('reports every migration as pending on an empty database, so the API is not ready', async () => {
      const status = await getMigrationStatus(pool);
      expect(status.applied).toEqual([]);
      expect(status.pending).toHaveLength(7);

      const res = await readiness();
      expect(res.status).toBe(503);
      expect(res.body).toMatchObject({
        status: 'not_ready',
        checks: { database: { status: 'up' }, migrations: { status: 'down' } },
      });
    });

    it('applies every migration exactly once, even when two processes start at the same time', async () => {
      const [first, second] = await Promise.all([runMigrations(pool), runMigrations(pool)]);

      const appliedTogether = [...first, ...second];
      expect(appliedTogether).toHaveLength(7);
      expect(new Set(appliedTogether).size).toBe(7);
      expect(await runMigrations(pool)).toEqual([]); // a third run has nothing to do
    });

    it('creates the six tables (plus schema_migrations), and the API becomes ready', async () => {
      const { rows } = await pool.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`,
      );
      expect(rows.map((row) => row.table_name)).toEqual(TABLES);

      const res = await readiness();
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: 'ready', checks: { database: { status: 'up' }, migrations: { status: 'up' } } });
    });

    it('records a SHA-256 checksum for every applied migration', async () => {
      const { rows } = await pool.query<{ checksum: string | null }>('SELECT checksum FROM schema_migrations');
      expect(rows).toHaveLength(7);
      for (const row of rows) expect(row.checksum).toMatch(/^[0-9a-f]{64}$/);
    });

    it('treats a Windows (CRLF) checkout of the same files as unchanged', async () => {
      const directory = await copyOfMigrations();
      for (const name of await readdir(directory)) {
        const path = join(directory, name);
        await writeFile(path, (await readFile(path, 'utf8')).replace(/\r?\n/g, '\r\n'));
      }

      const status = await getMigrationStatus(pool, directory);
      expect(status.modified).toEqual([]);
      expect(status.pending).toEqual([]);
    });

    it('refuses to run, and reports not ready, when an applied migration has been edited', async () => {
      const directory = await copyOfMigrations();
      const file = join(directory, '002_create_users.sql');
      await writeFile(file, `${await readFile(file, 'utf8')}\nALTER TABLE users ADD COLUMN nickname TEXT;\n`);

      await expect(runMigrations(pool, directory)).rejects.toThrow(/002_create_users\.sql changed after it was applied/);
      expect((await getMigrationStatus(pool, directory)).modified).toEqual(['002_create_users.sql']);
      expect((await readiness(directory)).status).toBe(503);

      // Nothing was changed: the column from the edited file does not exist
      const { rows } = await pool.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'nickname'`,
      );
      expect(rows).toHaveLength(0);
    });

    it('fills in checksums for databases migrated before checksums were recorded', async () => {
      await pool.query('ALTER TABLE schema_migrations DROP COLUMN checksum');

      const before = await getMigrationStatus(pool);
      expect(before.pending).toEqual([]);
      expect(before.modified).toEqual([]);

      expect(await runMigrations(pool)).toEqual([]);
      const { rows } = await pool.query<{ missing: number }>(
        'SELECT count(*)::int AS missing FROM schema_migrations WHERE checksum IS NULL',
      );
      expect(rows[0]?.missing).toBe(0);
    });

    it('applies a new migration file on its own, leaving the existing ones alone', async () => {
      const directory = await copyOfMigrations();
      await writeFile(join(directory, '008_add_test_note.sql'), 'ALTER TABLE incidents ADD COLUMN test_note TEXT;\n');

      expect(await runMigrations(pool, directory)).toEqual(['008_add_test_note.sql']);

      // Code without that file (e.g. an older version) lists it as unknown
      expect((await getMigrationStatus(pool)).missing).toEqual(['008_add_test_note.sql']);
    });
  });

  describe('constraints', () => {
    let citizenId: string;
    let responderId: string;
    let operatorId: string;
    let accidentTypeId: string;

    async function insertUser(email: string, role = 'CITIZEN'): Promise<string> {
      const { rows } = await pool.query<{ id: string }>(
        `INSERT INTO users (full_name, email, password_hash, role) VALUES ('Test User', $1, 'not-a-real-hash', $2)
         RETURNING id`,
        [email, role],
      );
      return rows[0]!.id;
    }

    async function insertIncident(values: Record<string, unknown> = {}) {
      const row = {
        reported_by: citizenId,
        incident_type_id: accidentTypeId,
        description: 'Two cars collided at the junction',
        latitude: 6.9271,
        longitude: 79.8612,
        ...values,
      };
      const columns = Object.keys(row);
      const { rows } = await pool.query<{ id: string; reference_no: string; status: string }>(
        `INSERT INTO incidents (${columns.join(', ')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')})
         RETURNING id, reference_no, status`,
        Object.values(row),
      );
      return rows[0]!;
    }

    beforeAll(async () => {
      citizenId = await insertUser('citizen@db-test.local');
      responderId = await insertUser('responder@db-test.local', 'RESPONDER');
      operatorId = await insertUser('operator@db-test.local', 'OPERATOR');
      const { rows } = await pool.query<{ id: string }>(`SELECT id FROM incident_types WHERE code = 'ACCIDENT'`);
      accidentTypeId = rows[0]!.id;
    });

    it('seeds the seven default incident types', async () => {
      const { rows } = await pool.query<{ code: string }>('SELECT code FROM incident_types ORDER BY code');
      expect(rows.map((row) => row.code)).toEqual(['ACCIDENT', 'BREAKDOWN', 'FIRE', 'FLOODING', 'HAZARD', 'OTHER', 'ROAD_BLOCK']);
    });

    it('treats emails that differ only in case as the same account', async () => {
      await expect(insertUser('CITIZEN@DB-TEST.local')).rejects.toMatchObject({ constraint: 'users_email_lower_key' });
    });

    it('only accepts the four roles', async () => {
      await expect(insertUser('someone@db-test.local', 'SUPERUSER')).rejects.toMatchObject({ code: '22P02' });
    });

    it('gives every incident a readable reference and starts it as REPORTED', async () => {
      const incident = await insertIncident();
      expect(incident.reference_no).toMatch(/^TF-\d{6}$/);
      expect(incident.status).toBe('REPORTED');
    });

    it('rejects impossible coordinates and too-short descriptions', async () => {
      await expect(insertIncident({ latitude: 95 })).rejects.toMatchObject({ constraint: 'incidents_latitude_range' });
      await expect(insertIncident({ longitude: -181 })).rejects.toMatchObject({ constraint: 'incidents_longitude_range' });
      await expect(insertIncident({ description: 'Crash' })).rejects.toMatchObject({
        constraint: 'incidents_description_length',
      });
    });

    it('requires a reason for REJECTED and a severity once an incident is verified', async () => {
      await expect(insertIncident({ status: 'REJECTED' })).rejects.toMatchObject({
        constraint: 'incidents_rejection_reason_required',
      });
      await expect(insertIncident({ status: 'VERIFIED' })).rejects.toMatchObject({
        constraint: 'incidents_severity_after_review',
      });
      await expect(insertIncident({ status: 'VERIFIED', severity: 'HIGH' })).resolves.toMatchObject({ status: 'VERIFIED' });
    });

    it('enforces foreign keys: no unknown reporters, and no deleting users who have incidents', async () => {
      await expect(insertIncident({ reported_by: '00000000-0000-4000-8000-000000000000' })).rejects.toMatchObject({
        code: '23503',
      });
      await expect(pool.query('DELETE FROM users WHERE id = $1', [citizenId])).rejects.toMatchObject({ code: '23503' });
    });

    it('updates updated_at automatically on every change', async () => {
      const { id } = await insertIncident();
      await pool.query(
        `UPDATE incidents SET created_at = '2020-06-01T00:00:00Z', updated_at = '2020-06-01T00:00:00Z' WHERE id = $1`,
        [id],
      );

      const { rows } = await pool.query<{ created_at: Date; updated_at: Date }>(
        'SELECT created_at, updated_at FROM incidents WHERE id = $1',
        [id],
      );
      expect(rows[0]!.created_at.getUTCFullYear()).toBe(2020);
      expect(rows[0]!.updated_at.getUTCFullYear()).toBeGreaterThan(2020); // the trigger overwrote it
    });

    it('lets an incident have several responders, but never the same responder twice at once', async () => {
      const { id: incidentId } = await insertIncident({ status: 'VERIFIED', severity: 'HIGH' });
      const assign = (responder: string, status = 'ASSIGNED') =>
        pool.query(
          'INSERT INTO incident_assignments (incident_id, responder_id, assigned_by, status) VALUES ($1, $2, $3, $4)',
          [incidentId, responder, operatorId, status],
        );

      await assign(responderId);
      await expect(assign(responderId)).rejects.toMatchObject({ constraint: 'incident_assignments_active_key' });

      const secondResponder = await insertUser('responder2@db-test.local', 'RESPONDER');
      await expect(assign(secondResponder)).resolves.toBeDefined();

      // A finished assignment doesn't block the same responder from being assigned again
      await pool.query(
        `UPDATE incident_assignments SET status = 'COMPLETED', completed_at = now()
         WHERE incident_id = $1 AND responder_id = $2`,
        [incidentId, responderId],
      );
      await expect(assign(responderId)).resolves.toBeDefined();
    });
  });
});
