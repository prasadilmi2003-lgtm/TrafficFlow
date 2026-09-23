import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool } from './pool.js';

/** database/migrations at the repository root (same depth from src/db and dist/db). */
export const DEFAULT_MIGRATIONS_DIR = fileURLToPath(new URL('../../../database/migrations', import.meta.url));

// Files must look like 001_create_users.sql and are applied in name order.
const MIGRATION_FILE = /^\d{3}_[a-z0-9_]+\.sql$/;

// Arbitrary constant: holding this PostgreSQL advisory lock guarantees that
// two processes (for example two containers starting together) never run
// migrations at the same time.
const MIGRATION_LOCK_ID = 727_274_001;

/**
 * Applies every migration file that has not been applied yet, in order.
 *
 * Applied files are recorded in the schema_migrations table. Each file runs
 * in its own transaction, so a failing migration leaves no half-applied
 * changes behind. Merged migrations are never edited: schema changes are
 * made by adding a new file.
 *
 * @returns the names of the files applied by this run
 */
export async function runMigrations(
  pool: Pool,
  directory: string = DEFAULT_MIGRATIONS_DIR,
  log: (message: string) => void = () => undefined,
): Promise<string[]> {
  const files = (await readdir(directory)).filter((name) => MIGRATION_FILE.test(name)).sort();
  const client = await pool.connect();

  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version    TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);

    const { rows } = await client.query<{ version: string }>('SELECT version FROM schema_migrations');
    const alreadyApplied = new Set(rows.map((row) => row.version));
    const appliedNow: string[] = [];

    for (const file of files) {
      if (alreadyApplied.has(file)) continue;

      const sql = await readFile(join(directory, file), 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`Migration ${file} failed: ${reason}`, { cause: error });
      }

      appliedNow.push(file);
      log(`Applied ${file}`);
    }

    return appliedNow;
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]).catch(() => undefined);
    client.release();
  }
}
