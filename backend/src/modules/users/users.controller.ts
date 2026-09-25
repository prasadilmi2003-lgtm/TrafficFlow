import type { RequestHandler } from 'express';
import { requireUser } from '../../utils/http.js';
import type { CreateUserInput, ListUsersQuery, UpdateUserInput } from './users.schemas.js';
import type { UsersService } from './users.service.js';

type IdParams = { id: string };

export function createUsersController(users: UsersService) {
  const list: RequestHandler = async (_req, res) => {
    res.json(await users.list(res.locals.query as ListUsersQuery));
  };

  const get: RequestHandler<IdParams> = async (req, res) => {
    res.json(await users.get(req.params.id));
  };

  const create: RequestHandler = async (req, res) => {
    res.status(201).json(await users.create(req.body as CreateUserInput));
  };

  const update: RequestHandler<IdParams> = async (req, res) => {
    res.json(await users.update(requireUser(req), req.params.id, req.body as UpdateUserInput));
  };

  return { list, get, create, update };
}
