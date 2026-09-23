import { z } from 'zod';
import { AVAILABILITIES, RESPONDER_TYPES } from '../../types/domain.js';

export const unitCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9][A-Z0-9-]{1,29}$/, 'Use letters, numbers and dashes, e.g. AMB-07');

export const listRespondersQuerySchema = z.object({
  type: z.enum(RESPONDER_TYPES).optional(),
  availability: z.enum(AVAILABILITIES).optional(),
  includeInactive: z.stringbool().default(false),
});
export type ListRespondersQuery = z.infer<typeof listRespondersQuerySchema>;

/** Admin changes to a responder profile */
export const updateResponderSchema = z
  .object({
    responderType: z.enum(RESPONDER_TYPES).optional(),
    unitCode: unitCode.optional(),
    availability: z.enum(AVAILABILITIES).optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), 'Nothing to update');
export type UpdateResponderInput = z.infer<typeof updateResponderSchema>;

/** A responder going on or off duty. BUSY is set automatically by assignments. */
export const availabilitySchema = z.object({
  availability: z.enum(['AVAILABLE', 'OFF_DUTY'], 'Choose AVAILABLE or OFF_DUTY'),
});
export type AvailabilityInput = z.infer<typeof availabilitySchema>;

export const assignmentScopeQuerySchema = z.object({
  scope: z.enum(['active', 'history']).default('active'),
});

export const responderIdParams = z.object({ id: z.uuid('Invalid responder id') });
export const assignmentIdParams = z.object({ id: z.uuid('Invalid assignment id') });
