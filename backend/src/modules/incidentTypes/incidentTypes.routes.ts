import { Router } from 'express';
import { z } from 'zod';
import { validateBody, validateParams } from '../../middleware/validate.js';
import { createIncidentTypesController } from './incidentTypes.controller.js';
import { createIncidentTypeSchema, updateIncidentTypeSchema } from './incidentTypes.schemas.js';
import type { IncidentTypesService } from './incidentTypes.service.js';

const idParams = z.object({ id: z.uuid('Invalid id') });

/** /api/v1/incident-types (any logged-in user): GET / lists the active types */
export function createIncidentTypesRouter(types: IncidentTypesService): Router {
  const router = Router();
  const controller = createIncidentTypesController(types);

  router.get('/', controller.listActive);

  return router;
}

/**
 * /api/v1/admin/incident-types (ADMIN)
 *
 *   GET   /     all types, including inactive ones
 *   POST  /     create a type
 *   PATCH /:id  rename, change the description, activate or deactivate
 */
export function createIncidentTypesAdminRouter(types: IncidentTypesService): Router {
  const router = Router();
  const controller = createIncidentTypesController(types);

  router.get('/', controller.listAll);
  router.post('/', validateBody(createIncidentTypeSchema), controller.create);
  router.patch('/:id', validateParams(idParams), validateBody(updateIncidentTypeSchema), controller.update);

  return router;
}
