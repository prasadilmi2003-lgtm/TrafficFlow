import type { RequestHandler } from 'express';
import { requireUser } from '../../utils/http.js';
import type { IncidentsService } from '../incidents/incidents.service.js';
import type { AvailabilityInput, ListRespondersQuery, UpdateResponderInput } from './responders.schemas.js';
import type { RespondersService } from './responders.service.js';

type IdParams = { id: string };

export function createRespondersController(responders: RespondersService, incidents: IncidentsService) {
  const list: RequestHandler = async (_req, res) => {
    res.json({ items: await responders.list(res.locals.query as ListRespondersQuery) });
  };

  const update: RequestHandler<IdParams> = async (req, res) => {
    res.json(await responders.update(req.params.id, req.body as UpdateResponderInput));
  };

  const myProfile: RequestHandler = async (req, res) => {
    res.json(await responders.getOwnProfile(requireUser(req)));
  };

  const setMyAvailability: RequestHandler = async (req, res) => {
    res.json(await responders.setOwnAvailability(requireUser(req), req.body as AvailabilityInput));
  };

  const myAssignments: RequestHandler = async (req, res) => {
    const { scope } = res.locals.query as { scope: 'active' | 'history' };
    res.json({ items: await incidents.listForResponder(requireUser(req), scope) });
  };

  const respond: RequestHandler<IdParams> = async (req, res) => {
    res.json(await incidents.respond(requireUser(req), req.params.id));
  };

  return { list, update, myProfile, setMyAvailability, myAssignments, respond };
}
