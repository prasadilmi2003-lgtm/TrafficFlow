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

const title = z
  .string('Give the report a short title')
  .trim()
  .min(5, 'Give the report a short title (at least 5 characters)')
  .max(120, 'Title is too long (maximum 120 characters)');

const description = z
  .string('Describe the incident')
  .trim()
  .min(10, 'Describe the incident in at least 10 characters')
  .max(2000, 'Description is too long (maximum 2000 characters)');

const latitude = z.coerce.number('Latitude must be a number').min(-90, 'Latitude must be between -90 and 90').max(90, 'Latitude must be between -90 and 90');
const longitude = z.coerce
  .number('Longitude must be a number')
  .min(-180, 'Longitude must be between -180 and 180')
  .max(180, 'Longitude must be between -180 and 180');

/**
 * Report form. Sent as multipart/form-data (because of the optional photo),
 * so every value arrives as a string and numbers are converted here.
 */
export const createIncidentSchema = z.object({
  incidentTypeId: z.uuid('Choose an incident type'),
  title,
  description,
  latitude,
  longitude,
  locationText: optionalText(255, 'Location description is too long'),
  // Optional: how serious the citizen thinks it is. An empty form field means "not sure".
  severity: z.preprocess(
    (value) => (value === '' || value === null ? undefined : value),
    z.enum(SEVERITIES, 'Choose low, medium, high or critical').optional(),
  ),
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

/**
 * Corrections to an incident's details (JSON). Citizens can edit their own
 * report until it is reviewed; operators can correct any open incident.
 */
export const updateIncidentSchema = z
  .object({
    title: title.optional(),
    description: description.optional(),
    incidentTypeId: z.uuid('Choose an incident type').optional(),
    severity: z.enum(SEVERITIES, 'Choose low, medium, high or critical').optional(),
    latitude: latitude.optional(),
    longitude: longitude.optional(),
    locationText: z
      .string()
      .trim()
      .max(255, 'Location description is too long')
      .nullable()
      .optional()
      .transform((value) => (value === undefined ? undefined : value || null)),
  })
  .refine((value) => (value.latitude === undefined) === (value.longitude === undefined), {
    message: 'Send latitude and longitude together',
    path: ['longitude'],
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), 'Nothing to update');
export type UpdateIncidentInput = z.infer<typeof updateIncidentSchema>;

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

export const addNoteSchema = z.object({
  note: z.string().trim().min(2, 'Write a note').max(1000, 'Note is too long (maximum 1000 characters)'),
});
export type AddNoteInput = z.infer<typeof addNoteSchema>;

/**
 * POST /incidents/:id/status: one endpoint for every step of the lifecycle.
 * The fields each step needs depend on the new status.
 */
export const statusChangeSchema = z.discriminatedUnion(
  'status',
  [
    verifySchema.extend({ status: z.literal('VERIFIED') }),
    rejectSchema.extend({ status: z.literal('REJECTED') }),
    assignSchema.extend({ status: z.literal('ASSIGNED') }),
    z.object({ status: z.literal('RESPONDING') }),
    resolveSchema.extend({ status: z.literal('RESOLVED') }),
  ],
  { error: 'Choose the new status: VERIFIED, REJECTED, ASSIGNED, RESPONDING or RESOLVED' },
);
export type StatusChangeInput = z.infer<typeof statusChangeSchema>;

export const incidentIdParams = z.object({ id: z.uuid('Invalid incident id') });

export const assignmentParams = z.object({
  id: z.uuid('Invalid incident id'),
  assignmentId: z.uuid('Invalid assignment id'),
});
