import express, { type Express } from 'express';
import helmet from 'helmet';
import type { AppConfig } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { apiRateLimiter } from './middleware/rateLimiter.js';
import { requestLogger } from './middleware/requestLogger.js';
import { createHealthRouter } from './modules/health/health.routes.js';
import type { HealthService } from './modules/health/health.service.js';
import type { Logger } from './utils/logger.js';

/** Everything the app needs, passed in so tests can supply their own versions. */
export interface AppDependencies {
  config: AppConfig;
  logger: Logger;
  health: HealthService;
}

/**
 * Builds the Express application without starting a server.
 *
 * server.ts starts it for real; tests call createApp() directly and send
 * requests to it in memory. The order of the middleware below matters.
 */
export function createApp({ config, logger, health }: AppDependencies): Express {
  const app = express();

  // Behind Nginx this is 1, so req.ip is the real client IP rather than Nginx's.
  app.set('trust proxy', config.trustProxy);
  app.disable('x-powered-by');

  // 1. Log every request with a request ID (first, so even failed requests are logged)
  app.use(requestLogger(logger));

  // 2. Security headers such as X-Content-Type-Options and Strict-Transport-Security
  app.use(helmet());

  // 3. Parse JSON request bodies, rejecting anything over 100 kB
  app.use(express.json({ limit: '100kb' }));

  // 4. Health endpoints: not versioned and not rate limited, because Docker,
  //    Nginx and the deployment pipeline call them
  app.use('/api/health', createHealthRouter(health));

  // 5. Versioned API. Feature modules are mounted here in later phases,
  //    for example: v1.use('/auth', createAuthRouter(...))
  const v1 = express.Router();
  v1.get('/', (_req, res) => {
    res.json({ name: 'TrafficFlow API', version: 'v1' });
  });
  app.use('/api/v1', apiRateLimiter(config.rateLimit), v1);

  // 6. No route matched: 404
  app.use(notFound);

  // 7. Every error ends up here and becomes a JSON response
  app.use(errorHandler(logger));

  return app;
}
