import { Router } from 'express';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate.js';
import type { IncidentsService } from '../incidents/incidents.service.js';
import { createRespondersController } from './responders.controller.js';
import {
  assignmentIdParams,
  assignmentScopeQuerySchema,
  availabilitySchema,
  listRespondersQuerySchema,
  responderIdParams,
  updateResponderSchema,
} from './responders.schemas.js';
import type { RespondersService } from './responders.service.js';

/** /api/v1/responders (OPERATOR, ADMIN): GET / lists responders, filterable by type and availability */
export function createRespondersRouter(responders: RespondersService, incidents: IncidentsService): Router {
  const router = Router();
  const controller = createRespondersController(responders, incidents);

  router.get('/', validateQuery(listRespondersQuerySchema), controller.list);

  return router;
}

/** /api/v1/admin/responders (ADMIN): PATCH /:id changes type, unit code or availability */
export function createRespondersAdminRouter(responders: RespondersService, incidents: IncidentsService): Router {
  const router = Router();
  const controller = createRespondersController(responders, incidents);

  router.patch('/:id', validateParams(responderIdParams), validateBody(updateResponderSchema), controller.update);

  return router;
}

/**
 * /api/v1/responder (RESPONDER, the logged-in responder's own data)
 *
 *   GET   /me                           own profile and availability
 *   PATCH /me/availability              go on duty (AVAILABLE) or off duty (OFF_DUTY)
 *   GET   /assignments?scope=active     own assignments (scope=history for finished ones)
 *   PATCH /assignments/:id/respond      start responding (ASSIGNED → RESPONDING)
 */
export function createResponderSelfRouter(responders: RespondersService, incidents: IncidentsService): Router {
  const router = Router();
  const controller = createRespondersController(responders, incidents);

  router.get('/me', controller.myProfile);
  router.patch('/me/availability', validateBody(availabilitySchema), controller.setMyAvailability);
  router.get('/assignments', validateQuery(assignmentScopeQuerySchema), controller.myAssignments);
  router.patch('/assignments/:id/respond', validateParams(assignmentIdParams), controller.respond);

  return router;
}
