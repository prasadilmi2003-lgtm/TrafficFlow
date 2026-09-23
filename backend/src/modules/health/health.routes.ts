import { Router } from 'express';
import { createHealthController } from './health.controller.js';
import type { HealthService } from './health.service.js';

/**
 * Health endpoints, mounted at /api/health in app.ts.
 *
 *   GET /api/health        liveness:  is the process running?
 *   GET /api/health/ready  readiness: are its dependencies available?
 */
export function createHealthRouter(health: HealthService): Router {
  const router = Router();
  const controller = createHealthController(health);

  router.get('/', controller.liveness);
  router.get('/ready', controller.readiness);

  return router;
}
