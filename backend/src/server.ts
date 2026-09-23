import { mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createApp } from './app.js';
import { ConfigError, loadConfig, loadEnvFile, type AppConfig } from './config/env.js';
import { createPool } from './db/pool.js';
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
const pool = createPool(config.database);
pool.on('error', (error) => {
  logger.error({ err: error }, 'Unexpected error on an idle database connection');
});

// 5. The folder for incident photos must exist before uploads arrive.
await mkdir(config.uploads.dir, { recursive: true });

// 6. The API only counts as "ready" when PostgreSQL answers.
const health = createHealthService({
  checks: [{ name: 'database', check: () => pool.query('SELECT 1') }],
  version: config.appVersion,
  logger,
});

// 7. Build the app and start the HTTP server.
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

/** Friendly startup check, so a missing database or migration is obvious in the logs. */
async function checkDatabase(): Promise<void> {
  try {
    const { rows } = await pool.query<{ applied: number }>('SELECT count(*)::int AS applied FROM schema_migrations');
    logger.info({ migrationsApplied: rows[0]?.applied }, 'Connected to PostgreSQL');
  } catch (error) {
    const code = (error as { code?: unknown }).code;
    if (code === '42P01') {
      logger.warn('Connected to PostgreSQL, but the tables are missing. Run: npm run db:migrate');
    } else {
      logger.warn({ err: error }, 'Cannot reach PostgreSQL yet. Check DATABASE_URL; /api/health/ready reports 503 until it works.');
    }
  }
}

// 8. Graceful shutdown. Docker sends SIGTERM when stopping a container;
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
