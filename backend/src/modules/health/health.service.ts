import { SERVICE_NAME } from '../../config/env.js';
import type { Logger } from '../../utils/logger.js';

/**
 * A dependency the API needs before it can serve real traffic.
 *
 * server.ts registers the PostgreSQL checks from db/readiness.ts, e.g.
 *   { name: 'database', check: () => pool.query('SELECT 1') }
 */
export interface ReadinessCheck {
  /** Name shown in the readiness response, e.g. "database" */
  name: string;
  /** Resolves if the dependency is usable; rejects (or times out) if not */
  check: () => Promise<unknown>;
}

export interface CheckResult {
  status: 'up' | 'down';
  responseTimeMs: number;
}

export interface ReadinessReport {
  status: 'ready' | 'not_ready' | 'shutting_down';
  checks: Record<string, CheckResult>;
}

export interface LivenessReport {
  status: 'ok';
  service: string;
  version: string;
  uptimeSeconds: number;
  timestamp: string;
}

export interface HealthService {
  /** Liveness: the process is running. Never checks external dependencies. */
  liveness(): LivenessReport;
  /** Readiness: runs every registered check. */
  readiness(): Promise<ReadinessReport>;
  /** Called when shutdown starts; readiness then reports "shutting_down". */
  markShuttingDown(): void;
}

export interface HealthServiceOptions {
  checks?: ReadinessCheck[];
  /** Maximum time each check may take before it counts as failed */
  timeoutMs?: number;
  version: string;
  logger: Logger;
}

const DEFAULT_CHECK_TIMEOUT_MS = 2000;

/** Rejects if the promise has not settled within `ms` milliseconds. */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${ms} ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export function createHealthService(options: HealthServiceOptions): HealthService {
  const { checks = [], timeoutMs = DEFAULT_CHECK_TIMEOUT_MS, version, logger } = options;
  let shuttingDown = false;

  async function runCheck(readinessCheck: ReadinessCheck): Promise<[string, CheckResult]> {
    const startedAt = performance.now();
    const elapsed = () => Math.round(performance.now() - startedAt);

    try {
      // Promise.resolve().then(...) also catches a check that throws synchronously
      await withTimeout(
        Promise.resolve().then(() => readinessCheck.check()),
        timeoutMs,
      );
      return [readinessCheck.name, { status: 'up', responseTimeMs: elapsed() }];
    } catch (error) {
      // Details go to the log only; the public response just says "down".
      logger.warn({ err: error, check: readinessCheck.name }, 'Readiness check failed');
      return [readinessCheck.name, { status: 'down', responseTimeMs: elapsed() }];
    }
  }

  return {
    liveness() {
      return {
        status: 'ok',
        service: SERVICE_NAME,
        version,
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
      };
    },

    async readiness() {
      if (shuttingDown) {
        return { status: 'shutting_down', checks: {} };
      }

      // Run all checks at the same time; each one has its own timeout.
      const results = await Promise.all(checks.map(runCheck));
      const allUp = results.every(([, result]) => result.status === 'up');

      return {
        status: allUp ? 'ready' : 'not_ready',
        checks: Object.fromEntries(results),
      };
    },

    markShuttingDown() {
      shuttingDown = true;
    },
  };
}
