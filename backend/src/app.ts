import express, { type Express } from 'express';
import helmet from 'helmet';
import type { AppConfig } from './config/env.js';
import type { Pool } from './db/pool.js';
import { authenticate } from './middleware/authenticate.js';
import { authorize } from './middleware/authorize.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { apiRateLimiter, loginRateLimiter } from './middleware/rateLimiter.js';
import { requestLogger } from './middleware/requestLogger.js';
import { imageUpload } from './middleware/upload.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import { createAuthService } from './modules/auth/auth.service.js';
import { createPasswordHasher } from './modules/auth/passwords.js';
import { createTokenService } from './modules/auth/tokens.js';
import { createHealthRouter } from './modules/health/health.routes.js';
import type { HealthService } from './modules/health/health.service.js';
import { createIncidentsRouter } from './modules/incidents/incidents.routes.js';
import { createIncidentsService } from './modules/incidents/incidents.service.js';
import {
  createIncidentTypesAdminRouter,
  createIncidentTypesRouter,
} from './modules/incidentTypes/incidentTypes.routes.js';
import { createIncidentTypesService } from './modules/incidentTypes/incidentTypes.service.js';
import { createProtectedTestRouter } from './modules/protected/protected.routes.js';
import {
  createResponderSelfRouter,
  createRespondersAdminRouter,
  createRespondersRouter,
} from './modules/responders/responders.routes.js';
import { createRespondersService } from './modules/responders/responders.service.js';
import { createStatsRouter } from './modules/stats/stats.routes.js';
import { createStatsService } from './modules/stats/stats.service.js';
import { createUsersAdminRouter } from './modules/users/users.routes.js';
import { createUsersService } from './modules/users/users.service.js';
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

  // 5. Services: the business logic, built once and shared by the routes
  const passwords = createPasswordHasher(config.auth.bcryptRounds);
  const tokens = createTokenService(config.auth);
  const services = {
    auth: createAuthService({ pool, passwords }),
    users: createUsersService({ pool, passwords }),
    incidentTypes: createIncidentTypesService({ pool }),
    incidents: createIncidentsService({ pool, logger, uploadDir: config.uploads.dir }),
    responders: createRespondersService({ pool }),
    stats: createStatsService({ pool, appVersion: config.appVersion }),
  };
  const requireLogin = authenticate({ db: pool, tokens });

  // 6. Versioned API. Each module's routes check roles and validate input.
  const v1 = express.Router();

  v1.get('/', (_req, res) => {
    res.json({ name: 'TrafficFlow API', version: 'v1' });
  });

  v1.use(
    '/auth',
    createAuthRouter({
      auth: services.auth,
      tokens,
      authenticate: requireLogin,
      loginLimiter: loginRateLimiter(config.rateLimit),
    }),
  );
  // A simple protected route that demonstrates authentication (any logged-in user)
  v1.use('/protected-test', requireLogin, createProtectedTestRouter());

  v1.use('/incident-types', requireLogin, createIncidentTypesRouter(services.incidentTypes));
  v1.use('/incidents', requireLogin, createIncidentsRouter(services.incidents, imageUpload(config.uploads)));
  v1.use(
    '/responders',
    requireLogin,
    authorize('OPERATOR', 'ADMIN'),
    createRespondersRouter(services.responders, services.incidents),
  );
  v1.use(
    '/responder',
    requireLogin,
    authorize('RESPONDER'),
    createResponderSelfRouter(services.responders, services.incidents),
  );
  v1.use('/stats', requireLogin, createStatsRouter(services.stats));

  const admin = express.Router();
  admin.use('/users', createUsersAdminRouter(services.users));
  admin.use('/responders', createRespondersAdminRouter(services.responders, services.incidents));
  admin.use('/incident-types', createIncidentTypesAdminRouter(services.incidentTypes));
  v1.use('/admin', requireLogin, authorize('ADMIN'), admin);

  app.use('/api/v1', apiRateLimiter(config.rateLimit), v1);

  // 7. No route matched: 404
  app.use(notFound);

  // 8. Every error ends up here and becomes a JSON response
  app.use(errorHandler(logger));

  return app;
}
