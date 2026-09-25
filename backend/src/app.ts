import express, { type Express } from 'express';
import helmet from 'helmet';
import type { AppConfig } from './config/env.js';
import type { Pool } from './db/pool.js';
import { authenticate } from './middleware/authenticate.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { apiRateLimiter, loginRateLimiter } from './middleware/rateLimiter.js';
import { requestLogger } from './middleware/requestLogger.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import { createAuthService } from './modules/auth/auth.service.js';
import { createPasswordHasher } from './modules/auth/passwords.js';
import { createTokenService } from './modules/auth/tokens.js';
import { createHealthRouter } from './modules/health/health.routes.js';
import type { HealthService } from './modules/health/health.service.js';
import { createProtectedTestRouter } from './modules/protected/protected.routes.js';
import type { Logger } from './utils/logger.js';

/** Everything the app needs, passed in so tests can supply their own versions. */
export interface AppDependencies {
  config: AppConfig;
  logger: Logger;
  health: HealthService;
  pool: Pool;
}

/**
 * Builds the Express application without starting a server.
 *
 * server.ts starts it for real; tests call createApp() directly and send
 * requests to it in memory. The order of the middleware below matters.
 */
export function createApp({ config, logger, health, pool }: AppDependencies): Express {
  const app = express();

  // Behind a reverse proxy this is 1, so req.ip is the real client IP.
  app.set('trust proxy', config.trustProxy);
  app.disable('x-powered-by');

  // 1. Log every request with a request ID (first, so even failed requests are logged)
  app.use(requestLogger(logger));

  // 2. Security headers such as X-Content-Type-Options and Strict-Transport-Security
  app.use(helmet());

  // 3. Parse JSON request bodies, rejecting anything over 100 kB
  app.use(express.json({ limit: '100kb' }));

  // 4. Health endpoints: not versioned and not rate limited
  app.use('/api/health', createHealthRouter(health));

  // 5. Authentication: password hashing, session tokens, and the middleware
  //    that protects routes (it checks the token, then loads the user from PostgreSQL)
  const passwords = createPasswordHasher(config.auth.bcryptRounds);
  const tokens = createTokenService(config.auth);
  const auth = createAuthService({ pool, passwords });
  const requireLogin = authenticate({ db: pool, tokens });

  // 6. Versioned API
  const v1 = express.Router();

  v1.get('/', (_req, res) => {
    res.json({ name: 'TrafficFlow API', version: 'v1' });
  });

  v1.use(
    '/auth',
    createAuthRouter({ auth, tokens, authenticate: requireLogin, loginLimiter: loginRateLimiter(config.rateLimit) }),
  );

  // A protected route: only reachable with a valid session
  v1.use('/protected-test', requireLogin, createProtectedTestRouter());

  app.use('/api/v1', apiRateLimiter(config.rateLimit), v1);

  // 7. No route matched: 404
  app.use(notFound);

  // 8. Every error ends up here and becomes a JSON response
  app.use(errorHandler(logger));

  return app;
}
