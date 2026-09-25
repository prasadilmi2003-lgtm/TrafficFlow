import type { ProtectedTestResponse, User } from '../types/api';
import { api } from './client';

export interface RegisterInput {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
}

/** /api/v1/auth: the session itself is an httpOnly cookie that the browser sends automatically. */
export const authApi = {
  me: () => api.get<User>('/auth/me').then((r) => r.data),
  login: (email: string, password: string) => api.post<User>('/auth/login', { email, password }).then((r) => r.data),
  register: (input: RegisterInput) => api.post<User>('/auth/register', input).then((r) => r.data),
  logout: () => api.post('/auth/logout').then(() => undefined),
};

/** A backend route that only answers logged-in users. */
export const protectedApi = {
  test: () => api.get<ProtectedTestResponse>('/protected-test').then((r) => r.data),
};
