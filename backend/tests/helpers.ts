import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';
import { createPool, type Pool } from '../src/db/pool.js';
import { createHealthService, type ReadinessCheck } from '../src/modules/health/health.service.js';
import { createLogger } from '../src/utils/logger.js';

/** Settings every test app gets. The JWT secret is a test-only value. */
export const TEST_ENV = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  DATABASE_URL: 'postgres://test:test@127.0.0.1:1/not_used',
  JWT_SECRET: 'test-only-secret-that-is-at-least-32-characters-long',
  BCRYPT_ROUNDS: '4',
};

export interface TestAppOptions {
  /** Extra environment variables, e.g. { RATE_LIMIT_MAX: '2' } */
  env?: Record<string, string>;
  /** Fake readiness checks instead of real dependencies */
  checks?: ReadinessCheck[];
  /** Short timeout so the "slow dependency" test runs quickly */
  readinessTimeoutMs?: number;
  /** A real database pool (integration tests). Otherwise a pool that is never connected. */
  pool?: Pool;
}

/**
 * Builds the real application with test settings: a silent logger and fake
 * readiness checks. No port is opened. Unless a pool is passed in, the
 * database is never contacted (pg only connects on the first query).
 */
export function buildTestApp(options: TestAppOptions = {}) {
  const config = loadConfig({ ...TEST_ENV, ...options.env });
  const logger = createLogger(config);
  const health = createHealthService({
    checks: options.checks ?? [],
    timeoutMs: options.readinessTimeoutMs ?? 2000,
    version: config.appVersion,
    logger,
  });
  const pool = options.pool ?? createPool(config.database);
  const app = createApp({ config, logger, health, pool });

  return { app, health, config, pool };
}
