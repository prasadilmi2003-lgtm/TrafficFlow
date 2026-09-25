import { Router } from 'express';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate.js';
import { createUsersController } from './users.controller.js';
import { createUserSchema, listUsersQuerySchema, updateUserSchema, userIdParams } from './users.schemas.js';
import type { UsersService } from './users.service.js';

/**
 * /api/v1/admin/users (ADMIN)
 *
 *   GET   /     list users (filter by role, active state, search; paged)
 *   GET   /:id  one user
 *   POST  /     create a user of any role (responders need a profile)
 *   PATCH /:id  change name, phone, role, active state or password
 */
export function createUsersAdminRouter(users: UsersService): Router {
  const router = Router();
  const controller = createUsersController(users);

  router.get('/', validateQuery(listUsersQuerySchema), controller.list);
  router.get('/:id', validateParams(userIdParams), controller.get);
  router.post('/', validateBody(createUserSchema), controller.create);
  router.patch('/:id', validateParams(userIdParams), validateBody(updateUserSchema), controller.update);

  return router;
}
