import { z } from 'zod';
import { RESPONDER_TYPES, ROLES } from '../../types/domain.js';
import { paginationFields } from '../../utils/pagination.js';
import { fields } from '../auth/auth.schemas.js';
import { unitCode } from '../responders/responders.schemas.js';

export const listUsersQuerySchema = z.object({
  ...paginationFields,
  role: z.enum(ROLES).optional(),
  isActive: z.stringbool().optional(),
  search: z.string().trim().max(100).optional(),
});
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

/** Admins can create accounts for every role. Responders also need a profile. */
export const createUserSchema = z
  .object({
    fullName: fields.fullName,
    email: fields.email,
    phone: fields.phone,
    password: fields.password,
    role: z.enum(ROLES, 'Choose a role'),
    responderProfile: z
      .object({
        responderType: z.enum(RESPONDER_TYPES, 'Choose a responder type'),
        unitCode,
      })
      .optional(),
  })
  .refine((user) => user.role !== 'RESPONDER' || user.responderProfile !== undefined, {
    message: 'Responders need a responder type and unit code',
    path: ['responderProfile'],
  });
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z
  .object({
    fullName: fields.fullName.optional(),
    phone: fields.phone.optional(),
    role: z.enum(ROLES).optional(),
    isActive: z.boolean().optional(),
    password: fields.password.optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), 'Nothing to update');
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const userIdParams = z.object({ id: z.uuid('Invalid user id') });
