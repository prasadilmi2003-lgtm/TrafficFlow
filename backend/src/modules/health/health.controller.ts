import type { RequestHandler } from 'express';
import type { HealthService } from './health.service.js';

/**
 * Controllers only deal with HTTP: they call the service and turn its result
 * into a response. The logic lives in health.service.ts.
 */
export function createHealthController(health: HealthService) {
  const liveness: RequestHandler = (_req, res) => {
    // no-store: a proxy or browser must never answer with an old health result
    res.set('Cache-Control', 'no-store').status(200).json(health.liveness());
  };

  const readiness: RequestHandler = async (_req, res) => {
    const report = await health.readiness();
    const statusCode = report.status === 'ready' ? 200 : 503;
    res.set('Cache-Control', 'no-store').status(statusCode).json(report);
  };

  return { liveness, readiness };
}
