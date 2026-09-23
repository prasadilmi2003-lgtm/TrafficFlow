import { z } from 'zod';
import { INCIDENT_STATUSES, SEVERITIES } from '../../types/domain.js';
import { paginationFields } from '../../utils/pagination.js';

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .nullish()
    .transform((value) => value || null);

/**
 * Report form. Sent as multipart/form-data (because of the optional photo),
 * so every value arrives as a string and numbers are converted here.
 */
export const createIncidentSchema = z.object({
  incidentTypeId: z.uuid('Choose an incident type'),
  description: z
    .string()
    .trim()
    .min(10, 'Describe the incident in at least 10 characters')
    .max(2000, 'Description is too long (maximum 2000 characters)'),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  locationText: optionalText(255, 'Location description is too long'),
});
export type CreateIncidentInput = z.infer<typeof createIncidentSchema>;

/** Accepts ?status=REPORTED&status=VERIFIED as well as ?status=REPORTED,VERIFIED */
const statusList = z.preprocess(
  (value) => (value === undefined ? undefined : (Array.isArray(value) ? value : [value]).flatMap((v) => String(v).split(','))),
  z.array(z.enum(INCIDENT_STATUSES)).optional(),
);

export const listIncidentsQuerySchema = z.object({
  ...paginationFields,
  status: statusList,
  typeId: z.uuid().optional(),
  severity: z.enum(SEVERITIES).optional(),
  search: z.string().trim().max(100).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type ListIncidentsQuery = z.infer<typeof listIncidentsQuerySchema>;

export const myIncidentsQuerySchema = z.object({
  ...paginationFields,
  status: statusList,
});
export type MyIncidentsQuery = z.infer<typeof myIncidentsQuerySchema>;

export const verifySchema = z.object({
  severity: z.enum(SEVERITIES, 'Choose a severity'),
  note: optionalText(500, 'Note is too long'),
});
export type VerifyInput = z.infer<typeof verifySchema>;

export const rejectSchema = z.object({
  reason: z.string().trim().min(5, 'Give a reason for rejecting the report').max(500, 'Reason is too long'),
});
export type RejectInput = z.infer<typeof rejectSchema>;

export const assignSchema = z.object({
  responderIds: z
    .array(z.uuid())
    .min(1, 'Choose at least one responder')
    .max(10, 'Assign at most 10 responders at a time'),
  notes: optionalText(500, 'Notes are too long'),
});
export type AssignInput = z.infer<typeof assignSchema>;

export const resolveSchema = z.object({
  resolutionNotes: z
    .string()
    .trim()
    .min(5, 'Describe how the incident was resolved')
    .max(1000, 'Notes are too long'),
});
export type ResolveInput = z.infer<typeof resolveSchema>;

export const incidentIdParams = z.object({ id: z.uuid('Invalid incident id') });

export const assignmentParams = z.object({
  id: z.uuid('Invalid incident id'),
  assignmentId: z.uuid('Invalid assignment id'),
});
