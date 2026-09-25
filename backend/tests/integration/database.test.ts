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
 * the migration runner, the readiness check, and the users table's
 * constraints.
 *
 * Like api.test.ts, they run only when TEST_DATABASE_URL is set, and the
 * test database is wiped first (its name must contain "test").
 */
loadEnvFile(); // lets TEST_DATABASE_URL live in backend/.env
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

const TABLES = ['schema_migrations', 'users'];

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
      expect(status.pending).toHaveLength(2);

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
      expect(appliedTogether).toHaveLength(2);
      expect(new Set(appliedTogether).size).toBe(2);
      expect(await runMigrations(pool)).toEqual([]); // a third run has nothing to do
    });

    it('creates the users table (plus schema_migrations), and the API becomes ready', async () => {
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
      expect(rows).toHaveLength(2);
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
      await writeFile(join(directory, '003_add_test_note.sql'), 'ALTER TABLE users ADD COLUMN test_note TEXT;\n');

      expect(await runMigrations(pool, directory)).toEqual(['003_add_test_note.sql']);

      // Code without that file (e.g. an older version) lists it as unknown
      expect((await getMigrationStatus(pool)).missing).toEqual(['003_add_test_note.sql']);
    });
  });

  describe('users table', () => {
    async function insertUser(values: Record<string, unknown>): Promise<Record<string, unknown>> {
      const row = { full_name: 'Test User', password_hash: 'not-a-real-hash', ...values };
      const columns = Object.keys(row);
      const { rows } = await pool.query(
        `INSERT INTO users (${columns.join(', ')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')})
         RETURNING *`,
        Object.values(row),
      );
      return rows[0]!;
    }

    it('gives a new user a UUID, the CITIZEN role, an active account and timestamps', async () => {
      const user = await insertUser({ email: 'defaults@db-test.local' });

      expect(user.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(user.role).toBe('CITIZEN');
      expect(user.is_active).toBe(true);
      expect(user.created_at).toBeInstanceOf(Date);
      expect(user.updated_at).toBeInstanceOf(Date);
      expect(user.last_login_at).toBeNull();
    });

    it('treats emails that differ only in case as the same account', async () => {
      await insertUser({ email: 'case@db-test.local' });
      await expect(insertUser({ email: 'CASE@DB-TEST.local' })).rejects.toMatchObject({
        constraint: 'users_email_lower_key',
      });
    });

    it('only accepts the four roles', async () => {
      for (const role of ['CITIZEN', 'OPERATOR', 'RESPONDER', 'ADMIN']) {
        await expect(insertUser({ email: `${role.toLowerCase()}@db-test.local`, role })).resolves.toMatchObject({ role });
      }
      await expect(insertUser({ email: 'super@db-test.local', role: 'SUPERUSER' })).rejects.toMatchObject({
        code: '22P02',
      });
    });

    it('requires a name, an email and a password hash', async () => {
      await expect(insertUser({ email: 'blank@db-test.local', full_name: '   ' })).rejects.toMatchObject({
        constraint: 'users_full_name_not_blank',
      });
      await expect(insertUser({ email: null })).rejects.toMatchObject({ code: '23502' });
      await expect(insertUser({ email: 'nohash@db-test.local', password_hash: null })).rejects.toMatchObject({
        code: '23502',
      });
    });

    it('updates updated_at automatically on every change', async () => {
      const { id } = await insertUser({ email: 'trigger@db-test.local' });
      await pool.query(
        `UPDATE users SET created_at = '2020-06-01T00:00:00Z', updated_at = '2020-06-01T00:00:00Z' WHERE id = $1`,
        [id],
      );

      const { rows } = await pool.query<{ created_at: Date; updated_at: Date }>(
        'SELECT created_at, updated_at FROM users WHERE id = $1',
        [id],
      );
      expect(rows[0]!.created_at.getUTCFullYear()).toBe(2020);
      expect(rows[0]!.updated_at.getUTCFullYear()).toBeGreaterThan(2020); // the trigger overwrote it
    });
  });
});
