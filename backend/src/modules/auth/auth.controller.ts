import type { RequestHandler } from 'express';
import { requireUser } from '../../utils/http.js';
import type { LoginInput, RegisterInput } from './auth.schemas.js';
import type { AuthService } from './auth.service.js';
import type { TokenService } from './tokens.js';

/** HTTP handlers for /api/v1/auth. Request bodies are already validated by the routes. */
export function createAuthController(auth: AuthService, tokens: TokenService) {
  const register: RequestHandler = async (req, res) => {
    const user = await auth.register(req.body as RegisterInput);
    tokens.setCookie(res, tokens.sign(user));
    res.status(201).json(user);
  };

  const login: RequestHandler = async (req, res) => {
    const user = await auth.login(req.body as LoginInput);
    tokens.setCookie(res, tokens.sign(user));
    res.json(user);
  };

  const logout: RequestHandler = (_req, res) => {
    tokens.clearCookie(res);
    res.status(204).end();
  };

  const me: RequestHandler = async (req, res) => {
    res.json(await auth.currentUser(requireUser(req)));
  };

  return { register, login, logout, me };
}
