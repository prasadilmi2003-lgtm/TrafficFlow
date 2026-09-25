/**
 * Applies pending database migrations, or shows which ones have run.
 *
 *   npm run db:migrate     apply every migration that hasn't run yet
 *   npm run db:status      list applied and pending migrations (changes nothing)
 *
 * The compiled version (node dist/scripts/migrate.js, or
 * npm run db:migrate:prod) is what Docker runs, where tsx isn't installed.
 *
 * Reads DATABASE_URL from the environment or backend/.env. Set
 * MIGRATIONS_DIR to use a folder other than database/migrations.
 */
import { ConfigError, loadDatabaseConfig, loadEnvFile } from '../config/env.js';
import { describeDatabaseUrl, explainDatabaseError } from '../db/errors.js';
import { DEFAULT_MIGRATIONS_DIR, getMigrationStatus, runMigrations } from '../db/migrate.js';
import { createPool, type Pool } from '../db/pool.js';

loadEnvFile();

async function migrate(pool: Pool, directory: string): Promise<void> {
  console.log(`Running migrations from ${directory}`);
  const applied = await runMigrations(pool, directory, (message) => console.log(`  ${message}`));
  console.log(applied.length === 0 ? 'Database is already up to date.' : `Applied ${applied.length} migration(s).`);
}

async function showStatus(pool: Pool, directory: string): Promise<void> {
  const status = await getMigrationStatus(pool, directory);
  const pad = (label: string) => label.padEnd(8);

  console.log(`Migrations in ${directory}`);
  for (const { version, appliedAt } of status.applied) {
    const flag = status.modified.includes(version) ? '  <- CHANGED after it was applied' : '';
    console.log(`  ${pad('applied')} ${version}  ${appliedAt.toISOString()}${flag}`);
  }
  for (const version of status.pending) console.log(`  ${pad('pending')} ${version}`);
  for (const version of status.missing) console.log(`  ${pad('unknown')} ${version}  (recorded in the database, no such file)`);

  console.log(`${status.applied.length} applied, ${status.pending.length} pending.`);
  if (status.pending.length > 0) console.log('Apply them with: npm run db:migrate');
  if (status.modified.length > 0) {
    console.error('Applied migrations must never be edited: undo the change and add a new migration file instead.');
    process.exitCode = 1;
  }
}

async function main(): Promise<void> {
  const database = loadDatabaseConfig();
  const pool = createPool(database);
  const directory = process.env.MIGRATIONS_DIR ?? DEFAULT_MIGRATIONS_DIR;

  try {
    console.log(`Database: ${describeDatabaseUrl(database.url)}`);
    await (process.argv.includes('--status') ? showStatus(pool, directory) : migrate(pool, directory));
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  if (error instanceof ConfigError) {
    console.error(error.message);
  } else {
    // A known problem (PostgreSQL not running, wrong password, ...) gets a
    // one-line explanation. Otherwise the message says which migration
    // failed and why, e.g. "Migration 008_x.sql failed: syntax error at ...".
    const message = error instanceof Error ? error.message : String(error);
    console.error(explainDatabaseError(error, process.env.DATABASE_URL ?? '') ?? message);
  }
  process.exit(1);
});
