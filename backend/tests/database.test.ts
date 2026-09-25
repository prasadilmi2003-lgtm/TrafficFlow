import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { describeDatabaseUrl, explainDatabaseError, isDatabaseUnavailable, isUniqueViolation } from '../src/db/errors.js';
import { assertSchemaUpToDate, migrationChecksum, readMigrationFiles, type MigrationFile } from '../src/db/migrate.js';
import type { Queryable } from '../src/db/pool.js';
import { databaseReadinessChecks } from '../src/db/readiness.js';

/** The same kind of errors pg and Node.js produce, e.g. pgError('57P01') */
const pgError = (code: string, message = 'database error') => Object.assign(new Error(message), { code });

/** A fake database whose schema_migrations table contains `applied`. */
function fakeDatabase(applied: MigrationFile[]): Queryable {
  return {
    query: async (text: string) => {
      const rows = text.includes('schema_migrations')
        ? applied.map((file) => ({ version: file.version, checksum: file.checksum, applied_at: new Date() }))
        : [{ '?column?': 1 }];
      return { rows, rowCount: rows.length, command: 'SELECT', oid: 0, fields: [] } as never;
    },
  };
}

describe('migration files', () => {
  let directory: string;

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'trafficflow-migrations-'));
    await writeFile(join(directory, '002_second.sql'), 'SELECT 2;');
    await writeFile(join(directory, '001_first.sql'), 'SELECT 1;');
    await writeFile(join(directory, 'README.md'), '# not a migration');
    await writeFile(join(directory, '3_bad_name.sql'), 'SELECT 3;');
  });

  afterAll(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('reads only correctly named .sql files, in name order', async () => {
    const files = await readMigrationFiles(directory);
    expect(files.map((file) => file.version)).toEqual(['001_first.sql', '002_second.sql']);
  });

  it('finds the real migrations for all six tables, in order', async () => {
    const versions = (await readMigrationFiles()).map((file) => file.version);
    expect(versions).toEqual([
      '001_create_types_and_functions.sql',
      '002_create_users.sql',
      '003_create_responder_profiles.sql',
      '004_create_incident_types.sql',
      '005_create_incidents.sql',
      '006_create_incident_assignments.sql',
      '007_create_incident_status_history.sql',
    ]);
  });

  it('gives a file the same checksum with Windows (CRLF) or Linux (LF) line endings', () => {
    const lf = 'CREATE TABLE a (id int);\nCREATE TABLE b (id int);\n';
    expect(migrationChecksum(lf.replace(/\n/g, '\r\n'))).toBe(migrationChecksum(lf));
    expect(migrationChecksum(`﻿${lf}`)).toBe(migrationChecksum(lf));
  });

  it('gives an edited file a different checksum', () => {
    expect(migrationChecksum('CREATE TABLE a (id int);')).not.toBe(migrationChecksum('CREATE TABLE a (id bigint);'));
  });
});

describe('schema readiness', () => {
  it('passes when every migration has been applied', async () => {
    const files = await readMigrationFiles();
    await expect(assertSchemaUpToDate(fakeDatabase(files))).resolves.toBeUndefined();
  });

  it('fails and names the missing migration when one has not been applied', async () => {
    const files = await readMigrationFiles();
    await expect(assertSchemaUpToDate(fakeDatabase(files.slice(0, -1)))).rejects.toThrow(
      /1 migration\(s\) not applied yet: 007_create_incident_status_history\.sql/,
    );
  });

  it('fails when an applied migration was edited afterwards', async () => {
    const files = await readMigrationFiles();
    const edited = files.map((file, index) => (index === 1 ? { ...file, checksum: 'from-an-older-version' } : file));
    await expect(assertSchemaUpToDate(fakeDatabase(edited))).rejects.toThrow(/002_create_users\.sql changed after it was applied/);
  });

  it('registers a "database" and a "migrations" readiness check', async () => {
    const files = await readMigrationFiles();
    const checks = databaseReadinessChecks(fakeDatabase(files));

    expect(checks.map((check) => check.name)).toEqual(['database', 'migrations']);
    for (const check of checks) await check.check(); // throws if the check fails
  });
});

describe('isDatabaseUnavailable', () => {
  it('recognises network errors, including refused connections to "localhost"', () => {
    expect(isDatabaseUnavailable(pgError('ECONNREFUSED', 'connect ECONNREFUSED 127.0.0.1:5432'))).toBe(true);
    expect(isDatabaseUnavailable(pgError('ENOTFOUND', 'getaddrinfo ENOTFOUND db'))).toBe(true);
    expect(
      isDatabaseUnavailable(new AggregateError([pgError('ECONNREFUSED'), pgError('ECONNREFUSED')], 'connect failed')),
    ).toBe(true);
  });

  it('recognises PostgreSQL refusing to serve: shutdown, wrong password, missing database, too many connections', () => {
    for (const code of ['57P01', '57P03', '08006', '28P01', '3D000', '53300']) {
      expect(isDatabaseUnavailable(pgError(code)), code).toBe(true);
    }
  });

  it('recognises connection timeouts and dropped connections', () => {
    expect(isDatabaseUnavailable(new Error('timeout exceeded when trying to connect'))).toBe(true);
    expect(isDatabaseUnavailable(new Error('Connection terminated unexpectedly'))).toBe(true);
  });

  it('does not treat query errors or bugs as an outage', () => {
    expect(isDatabaseUnavailable(pgError('23505', 'duplicate key value'))).toBe(false);
    expect(isDatabaseUnavailable(pgError('42601', 'syntax error'))).toBe(false);
    expect(isDatabaseUnavailable(new TypeError('Cannot read properties of undefined'))).toBe(false);
    expect(isDatabaseUnavailable(null)).toBe(false);
    expect(isDatabaseUnavailable('ECONNREFUSED')).toBe(false);
  });
});

describe('database error helpers', () => {
  const url = 'postgres://trafficflow:super-secret@db.example.com:5433/trafficflow';

  it('describes a connection string without its password', () => {
    expect(describeDatabaseUrl(url)).toBe('trafficflow@db.example.com:5433/trafficflow');
    expect(describeDatabaseUrl('postgres://app@localhost/app')).toBe('app@localhost:5432/app');
    expect(describeDatabaseUrl('not a url')).toBe('the database in DATABASE_URL');
  });

  it('explains common setup problems in one line, never showing the password', () => {
    const explanations = [
      explainDatabaseError(pgError('ECONNREFUSED'), url),
      explainDatabaseError(pgError('28P01'), url),
      explainDatabaseError(pgError('3D000'), url),
      explainDatabaseError(pgError('42P01'), url),
    ];

    expect(explanations[0]).toMatch(/Cannot connect to PostgreSQL at trafficflow@db\.example\.com:5433\/trafficflow/);
    expect(explanations[1]).toMatch(/rejected the user or password/);
    expect(explanations[2]).toMatch(/does not exist/);
    expect(explanations[3]).toMatch(/npm run db:migrate/);
    for (const explanation of explanations) expect(explanation).not.toContain('super-secret');
  });

  it('leaves other errors unexplained', () => {
    expect(explainDatabaseError(new Error('something else'), url)).toBeUndefined();
  });

  it('still recognises unique violations by constraint name', () => {
    const error = Object.assign(pgError('23505'), { constraint: 'users_email_lower_key' });
    expect(isUniqueViolation(error, 'users_email_lower_key')).toBe(true);
    expect(isUniqueViolation(error, 'another_key')).toBe(false);
  });
});
