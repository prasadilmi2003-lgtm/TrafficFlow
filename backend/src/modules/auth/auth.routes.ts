import { Router, type RequestHandler } from 'express';
import { validateBody } from '../../middleware/validate.js';
import { createAuthController } from './auth.controller.js';
import { loginSchema, registerSchema } from './auth.schemas.js';
import type { AuthService } from './auth.service.js';
import type { TokenService } from './tokens.js';

interface AuthRouterDeps {
  auth: AuthService;
  tokens: TokenService;
  authenticate: RequestHandler;
  /** Limits failed login and registration attempts per client IP */
  loginLimiter: RequestHandler;
}

/**
 * /api/v1/auth
 *
 *   POST /register  create a citizen account and log in
 *   POST /login     log in (sets the session cookie)
 *   POST /logout    log out (clears the session cookie)
 *   GET  /me        the logged-in user
 */
export function createAuthRouter({ auth, tokens, authenticate, loginLimiter }: AuthRouterDeps): Router {
  const router = Router();
  const controller = createAuthController(auth, tokens);

  router.post('/register', loginLimiter, validateBody(registerSchema), controller.register);
  router.post('/login', loginLimiter, validateBody(loginSchema), controller.login);
  router.post('/logout', controller.logout);
  router.get('/me', authenticate, controller.me);

  return router;
}
