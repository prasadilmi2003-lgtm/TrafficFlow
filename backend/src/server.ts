import { createServer } from 'node:http';
import { createApp } from './app.js';
import { ConfigError, loadConfig, loadEnvFile, type AppConfig } from './config/env.js';
import { explainDatabaseError, isDatabaseUnavailable } from './db/errors.js';
import { getMigrationStatus } from './db/migrate.js';
import { createPool } from './db/pool.js';
import { databaseReadinessChecks } from './db/readiness.js';
import { createHealthService } from './modules/health/health.service.js';
import { createLogger } from './utils/logger.js';

/** How long in-flight requests get to finish after a shutdown signal. */
const SHUTDOWN_TIMEOUT_MS = 10_000;

// 1. Load backend/.env during local development (existing variables win).
loadEnvFile();

// 2. Validate the configuration before doing anything else.
function loadConfigOrExit(): AppConfig {
  try {
    return loadConfig();
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }
}

const config = loadConfigOrExit();
const logger = createLogger(config);

// 3. Log crashes before exiting. Docker's restart policy then restarts the container.
process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Unhandled promise rejection, exiting');
  process.exit(1);
});
process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'Uncaught exception, exiting');
  process.exit(1);
});

// 4. Database connection pool (connections open on first use).
//    When PostgreSQL restarts, it closes the pool's idle connections. The
//    pool drops them and opens new ones on the next query, so this is only
//    a warning.
const pool = createPool(config.database);
pool.on('error', (error) => {
  if (isDatabaseUnavailable(error)) {
    logger.warn({ err: error }, 'PostgreSQL closed an idle connection (restart or outage); it will be replaced');
  } else {
    logger.error({ err: error }, 'Unexpected error on an idle database connection');
  }
});

// 5. The API only counts as "ready" when PostgreSQL answers and every
//    migration has been applied (see db/readiness.ts).
const health = createHealthService({
  checks: databaseReadinessChecks(pool),
  version: config.appVersion,
  logger,
});

// 6. Build the app and start the HTTP server.
const app = createApp({ config, logger, health, pool });
const server = createServer(app);

server.on('error', (error) => {
  logger.fatal({ err: error, port: config.port }, 'HTTP server could not start');
  process.exit(1);
});

server.listen(config.port, () => {
  logger.info(
    { port: config.port, env: config.env },
    `TrafficFlow API listening on http://localhost:${config.port}`,
  );
  void checkDatabase();
});

/**
 * Friendly startup check, so a missing database or migration is obvious in
 * the logs. The server keeps running either way: /api/health/ready reports
 * 503 until the problem is fixed.
 */
async function checkDatabase(): Promise<void> {
  try {
    const status = await getMigrationStatus(pool);
    if (status.modified.length > 0) {
      logger.error(
        { modified: status.modified },
        'Applied migrations were edited afterwards. Undo the edits and put schema changes in a new migration file.',
      );
    } else if (status.pending.length > 0) {
      logger.warn(
        { pending: status.pending },
        `Connected to PostgreSQL, but ${status.pending.length} migration(s) have not been applied. Run: npm run db:migrate`,
      );
    } else {
      logger.info({ migrationsApplied: status.applied.length }, 'Connected to PostgreSQL, database schema is up to date');
    }
  } catch (error) {
    const hint = explainDatabaseError(error, config.database.url) ?? 'Cannot check the database.';
    logger.warn({ err: error }, `${hint} (Until this is fixed, /api/health/ready answers 503.)`);
  }
}

// 7. Graceful shutdown. Docker sends SIGTERM when stopping a container;
//    Ctrl+C in a terminal sends SIGINT.
let shuttingDown = false;

function shutdown(signal: NodeJS.Signals): void {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Shutdown started');

  // Readiness now answers 503, so no new traffic should be routed here.
  health.markShuttingDown();

  // If something hangs, don't wait forever.
  const forceExit = setTimeout(() => {
    logger.error('Shutdown timed out, forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  // Stop accepting connections, wait for in-flight requests, then close the database pool.
  server.close((error) => {
    pool
      .end()
      .catch((poolError: unknown) => logger.error({ err: poolError }, 'Error while closing the database pool'))
      .finally(() => {
        if (error) {
          logger.error({ err: error }, 'Error while closing the HTTP server');
          process.exit(1);
        }
        logger.info('Shutdown complete');
        process.exit(0);
      });
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
