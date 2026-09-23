import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { createApp } from './app.js';
import { ConfigError, loadConfig, type AppConfig } from './config/env.js';
import { createHealthService, type ReadinessCheck } from './modules/health/health.service.js';
import { createLogger } from './utils/logger.js';

/** How long in-flight requests get to finish after a shutdown signal. */
const SHUTDOWN_TIMEOUT_MS = 10_000;

// 1. Load backend/.env during local development. Variables that are already
//    set (for example by Docker Compose) are not overwritten.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

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

// 4. Dependencies that must be available before the API counts as "ready".
//    Phase 3 adds: { name: 'database', check: () => pool.query('SELECT 1') }
const readinessChecks: ReadinessCheck[] = [];

const health = createHealthService({
  checks: readinessChecks,
  version: config.appVersion,
  logger,
});

// 5. Build the app and start the HTTP server.
const app = createApp({ config, logger, health });
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
});

// 6. Graceful shutdown. Docker sends SIGTERM when stopping a container;
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

  // Stop accepting connections and wait for in-flight requests to finish.
  server.close((error) => {
    // Phase 3: close the database connection pool here.
    if (error) {
      logger.error({ err: error }, 'Error while closing the HTTP server');
      process.exit(1);
    }
    logger.info('Shutdown complete');
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
