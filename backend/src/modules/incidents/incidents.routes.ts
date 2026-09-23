import { Router, type RequestHandler } from 'express';
import { authorize } from '../../middleware/authorize.js';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate.js';
import { createIncidentsController } from './incidents.controller.js';
import {
  assignmentParams,
  assignSchema,
  createIncidentSchema,
  incidentIdParams,
  listIncidentsQuerySchema,
  myIncidentsQuerySchema,
  rejectSchema,
  resolveSchema,
  verifySchema,
} from './incidents.schemas.js';
import type { IncidentsService } from './incidents.service.js';

/**
 * /api/v1/incidents (every route requires a logged-in user)
 *
 * Order on each route: role check → input validation → controller.
 *
 *   POST  /                                    CITIZEN    report (multipart, optional "image")
 *   GET   /mine                                CITIZEN    own reports
 *   GET   /                                    OPERATOR, ADMIN   all incidents (filters, paging)
 *   GET   /map                                 OPERATOR, ADMIN   open incidents for the map
 *   GET   /:id                                 owner, OPERATOR, ADMIN, assigned RESPONDER
 *   GET   /:id/image                           same as above
 *   PATCH /:id/verify                          OPERATOR   REPORTED → VERIFIED
 *   PATCH /:id/reject                          OPERATOR   REPORTED → REJECTED
 *   POST  /:id/assignments                     OPERATOR   assign responders
 *   PATCH /:id/assignments/:assignmentId/cancel OPERATOR  cancel an assignment
 *   PATCH /:id/resolve                         RESPONDER, OPERATOR   RESPONDING → RESOLVED
 */
export function createIncidentsRouter(incidents: IncidentsService, upload: RequestHandler): Router {
  const router = Router();
  const controller = createIncidentsController(incidents);
  const staff = authorize('OPERATOR', 'ADMIN');
  const operator = authorize('OPERATOR');
  const byId = validateParams(incidentIdParams);

  router.post('/', authorize('CITIZEN'), upload, validateBody(createIncidentSchema), controller.create);
  router.get('/mine', authorize('CITIZEN'), validateQuery(myIncidentsQuerySchema), controller.listMine);
  router.get('/', staff, validateQuery(listIncidentsQuerySchema), controller.list);
  router.get('/map', staff, controller.map);

  router.get('/:id', byId, controller.getById);
  router.get('/:id/image', byId, controller.image);

  router.patch('/:id/verify', operator, byId, validateBody(verifySchema), controller.verify);
  router.patch('/:id/reject', operator, byId, validateBody(rejectSchema), controller.reject);
  router.post('/:id/assignments', operator, byId, validateBody(assignSchema), controller.assign);
  router.patch(
    '/:id/assignments/:assignmentId/cancel',
    operator,
    validateParams(assignmentParams),
    controller.cancelAssignment,
  );
  router.patch(
    '/:id/resolve',
    authorize('RESPONDER', 'OPERATOR'),
    byId,
    validateBody(resolveSchema),
    controller.resolve,
  );

  return router;
}
