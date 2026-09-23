import { Router } from 'express';
import { authorize } from '../../middleware/authorize.js';
import { createStatsController } from './stats.controller.js';
import type { StatsService } from './stats.service.js';

/**
 * /api/v1/stats
 *
 *   GET /dashboard  OPERATOR, ADMIN   live operational statistics
 *   GET /system     ADMIN             users, totals and service information
 */
export function createStatsRouter(stats: StatsService): Router {
  const router = Router();
  const controller = createStatsController(stats);

  router.get('/dashboard', authorize('OPERATOR', 'ADMIN'), controller.dashboard);
  router.get('/system', authorize('ADMIN'), controller.system);

  return router;
}
