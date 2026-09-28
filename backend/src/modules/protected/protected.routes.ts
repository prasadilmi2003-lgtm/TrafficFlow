import { Router } from 'express';
import { requireUser } from '../../utils/http.js';

/**
 * GET /api/v1/protected-test
 *
 * A simple protected route that demonstrates authentication. app.ts puts the
 * authenticate middleware in front of it, so:
 *   - without a valid session cookie   → 401 AUTH_REQUIRED (or SESSION_EXPIRED)
 *   - with a valid session cookie      → 200 and the logged-in user
 */
export function createProtectedTestRouter(): Router {
  const router = Router();

  router.get('/', (req, res) => {
    const user = requireUser(req);
    res.json({
      message: `Hello ${user.fullName}, you are authenticated.`,
      user,
      accessedAt: new Date().toISOString(),
    });
  });

  return router;
}
