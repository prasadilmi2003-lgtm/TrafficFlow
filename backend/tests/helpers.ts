import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';
import { createHealthService, type ReadinessCheck } from '../src/modules/health/health.service.js';
import { createLogger } from '../src/utils/logger.js';

export interface TestAppOptions {
  /** Extra environment variables, e.g. { RATE_LIMIT_MAX: '2' } */
  env?: Record<string, string>;
  /** Fake readiness checks instead of real dependencies */
  checks?: ReadinessCheck[];
  /** Short timeout so the "slow dependency" test runs quickly */
  readinessTimeoutMs?: number;
}

/**
 * Builds the real application with test settings: a silent logger and
 * fake readiness checks. No port is opened and no database is needed.
 */
export function buildTestApp(options: TestAppOptions = {}) {
  const config = loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'silent', ...options.env });
  const logger = createLogger(config);
  const health = createHealthService({
    checks: options.checks ?? [],
    timeoutMs: options.readinessTimeoutMs ?? 2000,
    version: config.appVersion,
    logger,
  });
  const app = createApp({ config, logger, health });

  return { app, health, config };
}
