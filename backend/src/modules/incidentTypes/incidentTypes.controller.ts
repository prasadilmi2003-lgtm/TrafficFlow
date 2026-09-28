import type { RequestHandler } from 'express';
import type { CreateIncidentTypeInput, UpdateIncidentTypeInput } from './incidentTypes.schemas.js';
import type { IncidentTypesService } from './incidentTypes.service.js';

export function createIncidentTypesController(types: IncidentTypesService) {
  const listActive: RequestHandler = async (_req, res) => {
    res.json({ items: await types.listActive() });
  };

  const listAll: RequestHandler = async (_req, res) => {
    res.json({ items: await types.listAll() });
  };

  const create: RequestHandler = async (req, res) => {
    res.status(201).json(await types.create(req.body as CreateIncidentTypeInput));
  };

  const update: RequestHandler<{ id: string }> = async (req, res) => {
    res.json(await types.update(req.params.id, req.body as UpdateIncidentTypeInput));
  };

  return { listActive, listAll, create, update };
}
