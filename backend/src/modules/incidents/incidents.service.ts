import { unlink } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { Pool, Queryable } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import type { AuthUser, Paginated } from '../../types/domain.js';
import { AppError } from '../../utils/AppError.js';
import { detectImageType } from '../../utils/imageType.js';
import type { Logger } from '../../utils/logger.js';
import { paginated } from '../../utils/pagination.js';
import * as incidentTypes from '../incidentTypes/incidentTypes.repository.js';
import * as repository from './incidents.repository.js';
import type {
  Assignment,
  HistoryEntry,
  IncidentDetail,
  IncidentSummary,
  MapIncident,
  ResponderAssignment,
} from './incidents.repository.js';
import type {
  AssignInput,
  CreateIncidentInput,
  ListIncidentsQuery,
  MyIncidentsQuery,
  RejectInput,
  ResolveInput,
  VerifyInput,
} from './incidents.schemas.js';
import { ASSIGNABLE_STATUSES, assertTransition } from './lifecycle.js';

export interface IncidentWithActivity extends IncidentDetail {
  assignments: Assignment[];
  history: HistoryEntry[];
}

/** The uploaded photo, as saved by the upload middleware. */
export interface UploadedImage {
  path: string;
  filename: string;
}

interface Deps {
  pool: Pool;
  logger: Logger;
  uploadDir: string;
}

export function createIncidentsService({ pool, logger, uploadDir }: Deps) {
  /** Locks the incident for the rest of the transaction, or throws 404. */
  async function lockIncident(db: Queryable, id: string) {
    const incident = await repository.lockForUpdate(db, id);
    if (!incident) throw AppError.notFound('Incident not found');
    return incident;
  }

  /**
   * Who may see an incident:
   * - operators and admins: every incident
   * - citizens: only incidents they reported
   * - responders: only incidents they are (or were) assigned to
   *
   * Others get 404 rather than 403, so they can't tell whether it exists.
   */
  async function assertCanView(actor: AuthUser, incidentId: string, reportedBy: string): Promise<void> {
    const allowed =
      actor.role === 'OPERATOR' ||
      actor.role === 'ADMIN' ||
      (actor.role === 'CITIZEN' && reportedBy === actor.id) ||
      (actor.role === 'RESPONDER' && (await repository.isAssignedResponder(pool, incidentId, actor.id)));

    if (!allowed) throw AppError.notFound('Incident not found');
  }

  async function getById(actor: AuthUser, id: string): Promise<IncidentWithActivity> {
    const incident = await repository.findDetail(pool, id);
    if (!incident) throw AppError.notFound('Incident not found');
    await assertCanView(actor, id, incident.reportedBy.id);

    const [assignments, history] = await Promise.all([
      repository.listAssignments(pool, id),
      repository.listHistory(pool, id),
    ]);
    return { ...incident, assignments, history };
  }

  async function checkImage(image: UploadedImage): Promise<string> {
    const type = await detectImageType(image.path);
    if (!type) {
      await unlink(image.path).catch(() => undefined);
      throw AppError.badRequest('INVALID_FILE_TYPE', 'The file is not a valid JPEG, PNG or WebP image');
    }
    return image.filename;
  }

  return {
    getById,

    /** A citizen reports a new incident (status REPORTED). */
    async create(actor: AuthUser, input: CreateIncidentInput, image?: UploadedImage): Promise<IncidentWithActivity> {
      const type = await incidentTypes.findById(pool, input.incidentTypeId);
      if (!type || !type.isActive) {
        throw AppError.badRequest('INVALID_INCIDENT_TYPE', 'Choose a valid incident type');
      }

      const imagePath = image ? await checkImage(image) : null;

      const id = await withTransaction(pool, async (db) => {
        const incidentId = await repository.insert(db, {
          reportedBy: actor.id,
          incidentTypeId: input.incidentTypeId,
          description: input.description,
          latitude: input.latitude,
          longitude: input.longitude,
          locationText: input.locationText,
          imagePath,
        });
        await repository.insertHistory(db, {
          incidentId,
          fromStatus: null,
          toStatus: 'REPORTED',
          changedBy: actor.id,
          note: null,
        });
        return incidentId;
      });

      logger.info({ incidentId: id, type: type.code }, 'Incident reported');
      return getById(actor, id);
    },

    async listMine(actor: AuthUser, query: MyIncidentsQuery): Promise<Paginated<IncidentSummary>> {
      const { items, total } = await repository.list(pool, { reportedBy: actor.id, statuses: query.status }, query);
      return paginated(items, total, query);
    },

    async list(query: ListIncidentsQuery): Promise<Paginated<IncidentSummary>> {
      const { items, total } = await repository.list(
        pool,
        {
          statuses: query.status,
          typeId: query.typeId,
          severity: query.severity,
          search: query.search,
          from: query.from,
          to: query.to,
        },
        query,
      );
      return paginated(items, total, query);
    },

    listOpenForMap(): Promise<MapIncident[]> {
      return repository.listOpenForMap(pool);
    },

    /** Absolute path of the incident's photo, after the same access check as the incident itself. */
    async imagePath(actor: AuthUser, id: string): Promise<string> {
      const incident = await repository.findDetail(pool, id);
      if (!incident) throw AppError.notFound('Incident not found');
      await assertCanView(actor, id, incident.reportedBy.id);

      const fileName = await repository.findImagePath(pool, id);
      if (!fileName) throw AppError.notFound('This incident has no photo');
      // basename() guarantees the path stays inside the upload folder.
      return join(uploadDir, basename(fileName));
    },

    /** REPORTED → VERIFIED. The operator confirms the report and sets its severity. */
    async verify(actor: AuthUser, id: string, input: VerifyInput): Promise<IncidentWithActivity> {
      await withTransaction(pool, async (db) => {
        const incident = await lockIncident(db, id);
        assertTransition(incident.status, 'VERIFIED', actor.role);
        await repository.markVerified(db, id, input.severity, actor.id);
        await repository.insertHistory(db, {
          incidentId: id,
          fromStatus: incident.status,
          toStatus: 'VERIFIED',
          changedBy: actor.id,
          note: input.note ?? `Severity set to ${input.severity}`,
        });
      });
      return getById(actor, id);
    },

    /** REPORTED → REJECTED, with a reason the citizen can see. */
    async reject(actor: AuthUser, id: string, input: RejectInput): Promise<IncidentWithActivity> {
      await withTransaction(pool, async (db) => {
        const incident = await lockIncident(db, id);
        assertTransition(incident.status, 'REJECTED', actor.role);
        await repository.markRejected(db, id, input.reason, actor.id);
        await repository.insertHistory(db, {
          incidentId: id,
          fromStatus: incident.status,
          toStatus: 'REJECTED',
          changedBy: actor.id,
          note: input.reason,
        });
      });
      return getById(actor, id);
    },

    /**
     * Assigns one or more responders. The first assignment moves the incident
     * from VERIFIED to ASSIGNED; more responders can be added while it is
     * ASSIGNED or RESPONDING.
     */
    async assign(actor: AuthUser, id: string, input: AssignInput): Promise<IncidentWithActivity> {
      await withTransaction(pool, async (db) => {
        const incident = await lockIncident(db, id);

        if (!ASSIGNABLE_STATUSES.includes(incident.status)) {
          if (incident.status === 'REPORTED') {
            throw AppError.conflict('INCIDENT_NOT_VERIFIED', 'Verify the incident before assigning responders');
          }
          throw AppError.conflict('INCIDENT_CLOSED', `Responders can't be assigned to a ${incident.status.toLowerCase()} incident`);
        }

        const responderIds = [...new Set(input.responderIds)];
        const candidates = await repository.findResponderCandidates(db, responderIds);
        const active = await repository.listActiveAssignments(db, id);

        for (const responderId of responderIds) {
          const candidate = candidates.find((c) => c.id === responderId);
          if (!candidate || candidate.role !== 'RESPONDER' || !candidate.unitCode) {
            throw AppError.badRequest('INVALID_RESPONDER', 'One of the selected users is not a responder');
          }
          if (!candidate.isActive) {
            throw AppError.conflict('RESPONDER_INACTIVE', `${candidate.unitCode} is deactivated`);
          }
          if (candidate.availability === 'OFF_DUTY') {
            throw AppError.conflict('RESPONDER_OFF_DUTY', `${candidate.unitCode} is off duty`);
          }
          if (active.some((assignment) => assignment.responderId === responderId)) {
            throw AppError.conflict('ALREADY_ASSIGNED', `${candidate.unitCode} is already assigned to this incident`);
          }
        }

        for (const responderId of responderIds) {
          await repository.insertAssignment(db, { incidentId: id, responderId, assignedBy: actor.id, notes: input.notes });
        }
        await repository.markRespondersBusy(db, responderIds);

        if (incident.status === 'VERIFIED') {
          assertTransition('VERIFIED', 'ASSIGNED', actor.role);
          await repository.setStatus(db, id, 'ASSIGNED');
          const units = candidates.map((c) => c.unitCode).join(', ');
          await repository.insertHistory(db, {
            incidentId: id,
            fromStatus: 'VERIFIED',
            toStatus: 'ASSIGNED',
            changedBy: actor.id,
            note: `Assigned ${units}`,
          });
        }
      });
      return getById(actor, id);
    },

    /**
     * Cancels an assignment that hasn't started responding, e.g. to reassign
     * it. The last open assignment can't be cancelled (add the replacement
     * first), so the incident never moves backwards from ASSIGNED.
     */
    async cancelAssignment(actor: AuthUser, incidentId: string, assignmentId: string): Promise<IncidentWithActivity> {
      await withTransaction(pool, async (db) => {
        await lockIncident(db, incidentId);
        const assignment = await repository.findAssignment(db, assignmentId, { lock: true });
        if (!assignment || assignment.incidentId !== incidentId) {
          throw AppError.notFound('Assignment not found');
        }
        if (assignment.status !== 'ASSIGNED') {
          throw AppError.conflict(
            'ASSIGNMENT_NOT_CANCELLABLE',
            'Only assignments that have not started responding can be cancelled',
          );
        }

        const others = (await repository.listActiveAssignments(db, incidentId)).filter((a) => a.id !== assignmentId);
        if (others.length === 0) {
          throw AppError.conflict(
            'LAST_ASSIGNMENT',
            'This is the only responder on the incident. Assign a replacement before cancelling it.',
          );
        }

        await repository.markAssignmentCancelled(db, assignmentId);
        await repository.releaseResponders(db, [assignment.responderId]);
      });
      return getById(actor, incidentId);
    },

    /**
     * A responder starts responding. The first responder to do so moves the
     * incident from ASSIGNED to RESPONDING.
     */
    async respond(actor: AuthUser, assignmentId: string): Promise<IncidentWithActivity> {
      const found = await repository.findAssignment(pool, assignmentId);
      if (!found || found.responderId !== actor.id) throw AppError.notFound('Assignment not found');

      await withTransaction(pool, async (db) => {
        // Lock the incident first, then the assignment (same order everywhere, so no deadlocks)
        const incident = await lockIncident(db, found.incidentId);
        const assignment = await repository.findAssignment(db, assignmentId, { lock: true });
        if (!assignment || assignment.status !== 'ASSIGNED') {
          throw AppError.conflict('ASSIGNMENT_NOT_PENDING', 'This assignment is not waiting for a response');
        }

        await repository.markAssignmentResponding(db, assignmentId);

        if (incident.status === 'ASSIGNED') {
          assertTransition('ASSIGNED', 'RESPONDING', actor.role);
          await repository.setStatus(db, incident.id, 'RESPONDING');
          await repository.insertHistory(db, {
            incidentId: incident.id,
            fromStatus: 'ASSIGNED',
            toStatus: 'RESPONDING',
            changedBy: actor.id,
            note: `${actor.fullName} is responding`,
          });
        }
      });
      return getById(actor, found.incidentId);
    },

    /**
     * RESPONDING → RESOLVED, by a responder who is responding to the
     * incident, or by an operator as an override. Every open assignment is
     * completed and the responders become available again.
     */
    async resolve(actor: AuthUser, id: string, input: ResolveInput): Promise<IncidentWithActivity> {
      if (actor.role === 'RESPONDER' && !(await repository.isAssignedResponder(pool, id, actor.id))) {
        throw AppError.notFound('Incident not found');
      }

      await withTransaction(pool, async (db) => {
        const incident = await lockIncident(db, id);

        if (actor.role === 'RESPONDER') {
          const active = await repository.listActiveAssignments(db, id);
          const responding = active.some((a) => a.responderId === actor.id && a.status === 'RESPONDING');
          if (!responding) {
            throw AppError.forbidden('NOT_RESPONDING', 'Start responding to the incident before resolving it');
          }
        }

        assertTransition(incident.status, 'RESOLVED', actor.role);
        await repository.markResolved(db, id, input.resolutionNotes);
        const responders = await repository.completeOpenAssignments(db, id);
        await repository.releaseResponders(db, responders);
        await repository.insertHistory(db, {
          incidentId: id,
          fromStatus: incident.status,
          toStatus: 'RESOLVED',
          changedBy: actor.id,
          note: input.resolutionNotes,
        });
      });

      logger.info({ incidentId: id }, 'Incident resolved');
      return getById(actor, id);
    },

    /** The responder's own assignments: active ones, or finished ones for history. */
    listForResponder(actor: AuthUser, scope: 'active' | 'history'): Promise<ResponderAssignment[]> {
      const statuses = scope === 'active' ? (['ASSIGNED', 'RESPONDING'] as const) : (['COMPLETED', 'CANCELLED'] as const);
      return repository.listForResponder(pool, actor.id, statuses);
    },
  };
}

export type IncidentsService = ReturnType<typeof createIncidentsService>;
