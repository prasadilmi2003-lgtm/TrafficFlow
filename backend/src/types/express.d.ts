import type { AuthUser } from './domain.js';

// Adds the logged-in user to Express's Request type. The authenticate
// middleware (middleware/authenticate.ts) sets it.
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
