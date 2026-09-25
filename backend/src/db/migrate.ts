import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool, Queryable } from './pool.js';

/** database/migrations at the repository root (same depth from src/db and dist/db). */
export const DEFAULT_MIGRATIONS_DIR = fileURLToPath(new URL('../../../database/migrations', import.meta.url));

// Files must look like 001_create_users.sql and are applied in name order.
const MIGRATION_FILE = /^\d{3}_[a-z0-9_]+\.sql$/;

// Arbitrary constant: holding this PostgreSQL advisory lock guarantees that
// two processes (for example two containers starting together) never run
// migrations at the same time.
const MIGRATION_LOCK_ID = 727_274_001;

/** PostgreSQL error code for "undefined_table" */
const UNDEFINED_TABLE = '42P01';

export interface MigrationFile {
  /** The file name, e.g. "002_create_users.sql" */
  version: string;
  sql: string;
  checksum: string;
}

export interface MigrationStatus {
  /** Applied migrations whose file still exists, oldest first */
  applied: Array<{ version: string; appliedAt: Date }>;
  /** Files that have not been applied yet */
  pending: string[];
  /** Applied files whose content has changed since they were applied */
  modified: string[];
  /** Recorded as applied, but the file no longer exists (e.g. running older code) */
  missing: string[];
}

// A type alias (not an interface) so it satisfies pg's row type
type AppliedRow = {
  version: string;
  checksum: string | null;
  applied_at: Date;
};

/**
 * SHA-256 of a migration file. Line endings are normalised first, so a
 * Windows checkout (CRLF) and a Linux checkout (LF) of the same file get the
 * same checksum.
 */
export function migrationChecksum(sql: string): string {
  const normalised = sql.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  return createHash('sha256').update(normalised).digest('hex');
}

/** Reads the migration files in the order they are applied. Other files (e.g. README.md) are ignored. */
export async function readMigrationFiles(directory: string = DEFAULT_MIGRATIONS_DIR): Promise<MigrationFile[]> {
  const names = (await readdir(directory)).filter((name) => MIGRATION_FILE.test(name)).sort();
  return Promise.all(
    names.map(async (version) => {
      const sql = await readFile(join(directory, version), 'utf8');
      return { version, sql, checksum: migrationChecksum(sql) };
    }),
  );
}

/**
 * The rows of schema_migrations, or an empty list if the table doesn't exist
 * yet (a brand-new database). `SELECT *` also works for tables created before
 * the checksum column existed.
 */
async function readAppliedRows(db: Queryable): Promise<AppliedRow[]> {
  try {
    const { rows } = await db.query<AppliedRow>('SELECT * FROM schema_migrations ORDER BY version');
    return rows.map((row) => ({ ...row, checksum: row.checksum ?? null }));
  } catch (error) {
    if ((error as { code?: unknown }).code === UNDEFINED_TABLE) return [];
    throw error;
  }
}

function compare(files: MigrationFile[], rows: AppliedRow[]): MigrationStatus {
  const appliedByVersion = new Map(rows.map((row) => [row.version, row]));
  const fileVersions = new Set(files.map((file) => file.version));

  return {
    applied: rows
      .filter((row) => fileVersions.has(row.version))
      .map((row) => ({ version: row.version, appliedAt: row.applied_at })),
    pending: files.filter((file) => !appliedByVersion.has(file.version)).map((file) => file.version),
    modified: files
      .filter((file) => {
        const recorded = appliedByVersion.get(file.version)?.checksum;
        return recorded != null && recorded !== file.checksum;
      })
      .map((file) => file.version),
    missing: rows.filter((row) => !fileVersions.has(row.version)).map((row) => row.version),
  };
}

function modifiedError(versions: string[]): Error {
  return new Error(
    `Migration ${versions.join(', ')} changed after it was applied to this database. ` +
      'Applied migrations must never be edited: undo the change and put it in a new migration file instead.',
  );
}

/** Compares the migration files with what the database has applied. Read-only. */
export async function getMigrationStatus(
  db: Queryable,
  directory: string = DEFAULT_MIGRATIONS_DIR,
): Promise<MigrationStatus> {
  const [files, rows] = await Promise.all([readMigrationFiles(directory), readAppliedRows(db)]);
  return compare(files, rows);
}

/**
 * Resolves if every migration has been applied and none has been edited
 * since; rejects otherwise. Used by the readiness check, so the API only
 * reports "ready" when the schema matches the code.
 */
export async function assertSchemaUpToDate(db: Queryable, directory: string = DEFAULT_MIGRATIONS_DIR): Promise<void> {
  const status = await getMigrationStatus(db, directory);
  if (status.modified.length > 0) throw modifiedError(status.modified);
  if (status.pending.length > 0) {
    throw new Error(
      `${status.pending.length} migration(s) not applied yet: ${status.pending.join(', ')}. Run: npm run db:migrate`,
    );
  }
}

/**
 * Applies every migration file that has not been applied yet, in order.
 *
 * - Applied files are recorded in the schema_migrations table together with
 *   a checksum of their content.
 * - Each file runs in its own transaction, so a failing migration leaves no
 *   half-applied changes behind.
 * - If a file that was already applied has been edited, nothing runs and an
 *   error explains why: schema changes are made by adding a new file.
 *
 * @returns the names of the files applied by this run
 */
export async function runMigrations(
  pool: Pool,
  directory: string = DEFAULT_MIGRATIONS_DIR,
  log: (message: string) => void = () => undefined,
): Promise<string[]> {
  const files = await readMigrationFiles(directory);
  const client = await pool.connect();

  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version    TEXT PRIMARY KEY,
        checksum   TEXT,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
    // Tables created before checksums were recorded get the column now.
    await client.query('ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum TEXT');

    const rows = await readAppliedRows(client);
    const status = compare(files, rows);
    if (status.modified.length > 0) throw modifiedError(status.modified);

    // Record checksums for migrations applied before checksums existed.
    for (const row of rows) {
      const file = files.find((candidate) => candidate.version === row.version);
      if (row.checksum === null && file) {
        await client.query('UPDATE schema_migrations SET checksum = $2 WHERE version = $1', [file.version, file.checksum]);
      }
    }

    const appliedNow: string[] = [];
    for (const file of files) {
      if (!status.pending.includes(file.version)) continue;

      try {
        await client.query('BEGIN');
        await client.query(file.sql);
        await client.query('INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)', [
          file.version,
          file.checksum,
        ]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`Migration ${file.version} failed: ${reason}`, { cause: error });
      }

      appliedNow.push(file.version);
      log(`Applied ${file.version}`);
    }

    return appliedNow;
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]).catch(() => undefined);
    client.release();
  }
}
