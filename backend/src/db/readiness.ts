import type { ReadinessCheck } from '../modules/health/health.service.js';
import { assertSchemaUpToDate, DEFAULT_MIGRATIONS_DIR } from './migrate.js';
import type { Queryable } from './pool.js';

/**
 * The readiness checks for PostgreSQL, registered in server.ts:
 *
 * - database:   PostgreSQL answers a trivial query.
 * - migrations: every migration file has been applied, and none has been
 *               edited since. An API running against an old schema would
 *               fail on its first real request, so it is not "ready".
 *
 * GET /api/health/ready returns 200 only when both are up.
 */
export function databaseReadinessChecks(db: Queryable, migrationsDir: string = DEFAULT_MIGRATIONS_DIR): ReadinessCheck[] {
  return [
    { name: 'database', check: () => db.query('SELECT 1') },
    { name: 'migrations', check: () => assertSchemaUpToDate(db, migrationsDir) },
  ];
}
