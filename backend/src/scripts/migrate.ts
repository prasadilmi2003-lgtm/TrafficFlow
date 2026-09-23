/**
 * Applies pending database migrations.
 *
 *   npm run db:migrate
 *
 * Reads DATABASE_URL from the environment or backend/.env. Set
 * MIGRATIONS_DIR to use a folder other than database/migrations.
 */
import { ConfigError, loadDatabaseConfig, loadEnvFile } from '../config/env.js';
import { DEFAULT_MIGRATIONS_DIR, runMigrations } from '../db/migrate.js';
import { createPool } from '../db/pool.js';

loadEnvFile();

async function main(): Promise<void> {
  const pool = createPool(loadDatabaseConfig());
  const directory = process.env.MIGRATIONS_DIR ?? DEFAULT_MIGRATIONS_DIR;

  try {
    console.log(`Running migrations from ${directory}`);
    const applied = await runMigrations(pool, directory, (message) => console.log(`  ${message}`));
    console.log(applied.length === 0 ? 'Database is already up to date.' : `Applied ${applied.length} migration(s).`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof ConfigError ? error.message : error);
  process.exit(1);
});
