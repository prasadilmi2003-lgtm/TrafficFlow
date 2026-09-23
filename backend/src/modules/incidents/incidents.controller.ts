import type { RequestHandler } from 'express';
import { requireUser } from '../../utils/http.js';
import type {
  AssignInput,
  CreateIncidentInput,
  ListIncidentsQuery,
  MyIncidentsQuery,
  RejectInput,
  ResolveInput,
  VerifyInput,
} from './incidents.schemas.js';
import type { IncidentsService } from './incidents.service.js';

type IdParams = { id: string };

/** HTTP handlers for /api/v1/incidents. Input is already validated by the routes. */
export function createIncidentsController(incidents: IncidentsService) {
  const create: RequestHandler = async (req, res) => {
    const image = req.file ? { path: req.file.path, filename: req.file.filename } : undefined;
    const incident = await incidents.create(requireUser(req), req.body as CreateIncidentInput, image);
    res.status(201).json(incident);
  };

  const listMine: RequestHandler = async (req, res) => {
    res.json(await incidents.listMine(requireUser(req), res.locals.query as MyIncidentsQuery));
  };

  const list: RequestHandler = async (_req, res) => {
    res.json(await incidents.list(res.locals.query as ListIncidentsQuery));
  };

  const map: RequestHandler = async (_req, res) => {
    res.json({ items: await incidents.listOpenForMap() });
  };

  const getById: RequestHandler<IdParams> = async (req, res) => {
    res.json(await incidents.getById(requireUser(req), req.params.id));
  };

  const image: RequestHandler<IdParams> = async (req, res) => {
    const path = await incidents.imagePath(requireUser(req), req.params.id);
    // "private": browsers may cache the photo, shared caches (proxies) may not
    res.sendFile(path, { headers: { 'Cache-Control': 'private, max-age=300' } });
  };

  const verify: RequestHandler<IdParams> = async (req, res) => {
    res.json(await incidents.verify(requireUser(req), req.params.id, req.body as VerifyInput));
  };

  const reject: RequestHandler<IdParams> = async (req, res) => {
    res.json(await incidents.reject(requireUser(req), req.params.id, req.body as RejectInput));
  };

  const assign: RequestHandler<IdParams> = async (req, res) => {
    res.json(await incidents.assign(requireUser(req), req.params.id, req.body as AssignInput));
  };

  const cancelAssignment: RequestHandler<IdParams & { assignmentId: string }> = async (req, res) => {
    res.json(await incidents.cancelAssignment(requireUser(req), req.params.id, req.params.assignmentId));
  };

  const resolve: RequestHandler<IdParams> = async (req, res) => {
    res.json(await incidents.resolve(requireUser(req), req.params.id, req.body as ResolveInput));
  };

  return { create, listMine, list, map, getById, image, verify, reject, assign, cancelAssignment, resolve };
}
