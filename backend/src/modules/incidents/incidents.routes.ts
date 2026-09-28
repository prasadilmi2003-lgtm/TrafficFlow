import { Router, type RequestHandler } from 'express';
import { authorize } from '../../middleware/authorize.js';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate.js';
import { createIncidentsController } from './incidents.controller.js';
import {
  addNoteSchema,
  assignmentParams,
  assignSchema,
  createIncidentSchema,
  incidentIdParams,
  listIncidentsQuerySchema,
  myIncidentsQuerySchema,
  rejectSchema,
  resolveSchema,
  statusChangeSchema,
  updateIncidentSchema,
  verifySchema,
} from './incidents.schemas.js';
import type { IncidentsService } from './incidents.service.js';

/**
 * /api/v1/incidents (every route requires a logged-in user)
 *
 * Order on each route: role check → input validation → controller.
 *
 *   POST  /                    CITIZEN            report (multipart, optional "image")
 *   GET   /                    everyone           incidents the user may see: all (OPERATOR, ADMIN),
 *                                                 own reports (CITIZEN), assigned ones (RESPONDER)
 *   GET   /mine                CITIZEN            own reports
 *   GET   /map                 OPERATOR, ADMIN    open incidents for the map
 *   GET   /:id                 owner, OPERATOR, ADMIN, assigned RESPONDER
 *   GET   /:id/image           same as above
 *   PATCH /:id                 owner CITIZEN (until reviewed), OPERATOR   correct the details
 *   POST  /:id/status          OPERATOR, RESPONDER  any lifecycle step: { status, ...fields }
 *   POST  /:id/verify          OPERATOR           REPORTED → VERIFIED   (PATCH also accepted)
 *   POST  /:id/reject          OPERATOR           REPORTED → REJECTED   (PATCH also accepted)
 *   POST  /:id/assign          OPERATOR           assign responders     (also POST /:id/assignments)
 *   PATCH /:id/assignments/:assignmentId/cancel   OPERATOR   cancel an assignment before responding
 *   POST  /:id/resolve         RESPONDER, OPERATOR  RESPONDING → RESOLVED (PATCH also accepted)
 *   POST  /:id/notes           assigned RESPONDER, OPERATOR   add a note (status unchanged)
 *
 * Responders accept and start their assignments under /api/v1/responder.
 */
export function createIncidentsRouter(incidents: IncidentsService, upload: RequestHandler): Router {
  const router = Router();
  const controller = createIncidentsController(incidents);
  const staff = authorize('OPERATOR', 'ADMIN');
  const operator = authorize('OPERATOR');
  const byId = validateParams(incidentIdParams);

  router.post('/', authorize('CITIZEN'), upload, validateBody(createIncidentSchema), controller.create);
  router.get('/', validateQuery(listIncidentsQuerySchema), controller.list);
  router.get('/mine', authorize('CITIZEN'), validateQuery(myIncidentsQuerySchema), controller.listMine);
  router.get('/map', staff, controller.map);

  router.get('/:id', byId, controller.getById);
  router.get('/:id/image', byId, controller.image);
  router.patch('/:id', authorize('CITIZEN', 'OPERATOR'), byId, validateBody(updateIncidentSchema), controller.update);

  router.post(
    '/:id/status',
    authorize('OPERATOR', 'RESPONDER'),
    byId,
    validateBody(statusChangeSchema),
    controller.changeStatus,
  );

  const verify = [operator, byId, validateBody(verifySchema), controller.verify];
  router.post('/:id/verify', ...verify);
  router.patch('/:id/verify', ...verify);

  const reject = [operator, byId, validateBody(rejectSchema), controller.reject];
  router.post('/:id/reject', ...reject);
  router.patch('/:id/reject', ...reject);

  const assign = [operator, byId, validateBody(assignSchema), controller.assign];
  router.post('/:id/assign', ...assign);
  router.post('/:id/assignments', ...assign);
  router.patch(
    '/:id/assignments/:assignmentId/cancel',
    operator,
    validateParams(assignmentParams),
    controller.cancelAssignment,
  );

  const resolve = [authorize('RESPONDER', 'OPERATOR'), byId, validateBody(resolveSchema), controller.resolve];
  router.post('/:id/resolve', ...resolve);
  router.patch('/:id/resolve', ...resolve);

  router.post('/:id/notes', authorize('RESPONDER', 'OPERATOR'), byId, validateBody(addNoteSchema), controller.addNote);

  return router;
}
