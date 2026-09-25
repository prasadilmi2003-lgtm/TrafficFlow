/**
 * Types for the data the backend API returns. They mirror the backend's
 * response shapes (backend/src/modules/*); dates arrive as ISO strings.
 */

export type Role = 'CITIZEN' | 'OPERATOR' | 'RESPONDER' | 'ADMIN';

/** A user as returned by /auth/register, /auth/login and /auth/me (never includes the password). */
export interface User {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: Role;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Response of GET /protected-test */
export interface ProtectedTestResponse {
  message: string;
  user: { id: string; fullName: string; email: string; role: Role };
  accessedAt: string;
}

/** Every error response from the API has this shape. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
    requestId?: string;
  };
}
