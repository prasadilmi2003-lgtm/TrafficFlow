import type { RequestHandler } from 'express';
import type { StatsService } from './stats.service.js';

export function createStatsController(stats: StatsService) {
  const dashboard: RequestHandler = async (_req, res) => {
    res.json(await stats.dashboard());
  };

  const system: RequestHandler = async (_req, res) => {
    res.json(await stats.system());
  };

  return { dashboard, system };
}
