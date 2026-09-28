import axios, { isAxiosError } from 'axios';
import type { ApiErrorBody } from '../types/api';

/**
 * The one HTTP client for the whole app. Requests go to /api/v1 on the same
 * origin (Vite forwards them in development, Nginx in production), and the
 * browser sends the httpOnly session cookie automatically.
 */
export const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  timeout: 20_000,
});

/** Fired when the server says the session is no longer valid. AuthProvider listens for it. */
export const SESSION_EXPIRED_EVENT = 'trafficflow:session-expired';

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const isAuthCall = isAxiosError(error) && (error.config?.url ?? '').startsWith('/auth/');
    if (isAxiosError(error) && error.response?.status === 401 && !isAuthCall) {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
    return Promise.reject(error);
  },
);

function errorBody(error: unknown): ApiErrorBody['error'] | undefined {
  return isAxiosError<ApiErrorBody>(error) ? error.response?.data?.error : undefined;
}

/** A message that can be shown to the user for any failed request. */
export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (isAxiosError(error) && !error.response) {
    return 'Cannot reach the server. Check your connection and try again.';
  }
  return errorBody(error)?.message ?? fallback;
}

/** Per-field messages from a 400 VALIDATION_ERROR response, e.g. { email: 'Enter a valid email address' }. */
export function fieldErrors(error: unknown): Record<string, string> {
  const result: Record<string, string> = {};
  for (const detail of errorBody(error)?.details ?? []) {
    if (detail.field && !(detail.field in result)) result[detail.field] = detail.message;
  }
  return result;
}
