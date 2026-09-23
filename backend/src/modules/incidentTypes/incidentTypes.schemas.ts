import { z } from 'zod';

const name = z.string().trim().min(2, 'Enter a name').max(60, 'Name is too long');
const description = z
  .string()
  .trim()
  .max(500, 'Description is too long')
  .nullish()
  .transform((value) => value || null);

export const createIncidentTypeSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z][A-Z0-9_]{1,29}$/, 'Use capital letters, numbers and underscores, e.g. OIL_SPILL'),
  name,
  description,
});
export type CreateIncidentTypeInput = z.infer<typeof createIncidentTypeSchema>;

export const updateIncidentTypeSchema = z
  .object({
    name: name.optional(),
    description: description.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), 'Nothing to update');
export type UpdateIncidentTypeInput = z.infer<typeof updateIncidentTypeSchema>;
