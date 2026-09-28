import { unlink } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { Pool, Queryable } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import { PENDING_ASSIGNMENT_STATUSES, type AuthUser, type Paginated } from '../../types/domain.js';
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
  AddNoteInput,
  AssignInput,
  CreateIncidentInput,
  ListIncidentsQuery,
  MyIncidentsQuery,
  RejectInput,
  ResolveInput,
  StatusChangeInput,
  UpdateIncidentInput,
  VerifyInput,
} from './incidents.schemas.js';
import { ASSIGNABLE_STATUSES, assertTransition, FINAL_STATUSES, TRANSITIONS } from './lifecycle.js';

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

  const service = {
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
          title: input.title,
          description: input.description,
          latitude: input.latitude,
          longitude: input.longitude,
          locationText: input.locationText,
          severity: input.severity ?? null,
          imagePath,
        });
        await repository.insertHistory(db, {
          incidentId,
          fromStatus: null,
          toStatus: 'REPORTED',
          changedBy: actor.id,
          note: input.severity ? `Severity estimated by the reporter: ${input.severity}` : null,
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

    /**
     * GET /incidents, scoped to what the user may see: operators and admins
     * get every incident, citizens their own reports, and responders the
     * incidents they are (or were) assigned to.
     */
    async list(actor: AuthUser, query: ListIncidentsQuery): Promise<Paginated<IncidentSummary>> {
      const scope =
        actor.role === 'CITIZEN' ? { reportedBy: actor.id } : actor.role === 'RESPONDER' ? { assignedTo: actor.id } : {};
      const { items, total } = await repository.list(
        pool,
        {
          ...scope,
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

    /**
     * Corrects an incident's details (title, description, type, severity,
     * location). Citizens can edit their own report until an operator has
     * reviewed it; operators can correct any open incident. Resolved and
     * rejected incidents are final. The change is noted in the timeline.
     */
    async update(actor: AuthUser, id: string, input: UpdateIncidentInput): Promise<IncidentWithActivity> {
      const newType = input.incidentTypeId ? await incidentTypes.findById(pool, input.incidentTypeId) : null;
      if (input.incidentTypeId && (!newType || !newType.isActive)) {
        throw AppError.badRequest('INVALID_INCIDENT_TYPE', 'Choose a valid incident type');
      }

      await withTransaction(pool, async (db) => {
        const locked = await lockIncident(db, id);

        if (actor.role === 'CITIZEN' && locked.reportedBy !== actor.id) throw AppError.notFound('Incident not found');
        if (FINAL_STATUSES.includes(locked.status)) {
          throw AppError.conflict('INCIDENT_CLOSED', `A ${locked.status.toLowerCase()} incident can't be edited`);
        }
        if (actor.role === 'CITIZEN' && locked.status !== 'REPORTED') {
          throw AppError.conflict(
            'ALREADY_REVIEWED',
            'Your report has already been reviewed, so it can no longer be edited. Add the details the operators need by contacting them.',
          );
        }

        const current = (await repository.findDetail(db, id))!;
        const changes: repository.IncidentChanges = {};
        const changed: string[] = [];

        if (input.title !== undefined && input.title !== current.title) {
          changes.title = input.title;
          changed.push('title');
        }
        if (input.description !== undefined && input.description !== current.description) {
          changes.description = input.description;
          changed.push('description');
        }
        if (newType && newType.id !== current.type.id) {
          changes.incidentTypeId = newType.id;
          changed.push(`type (${current.type.name} → ${newType.name})`);
        }
        if (input.severity !== undefined && input.severity !== current.severity) {
          changes.severity = input.severity;
          changed.push(`severity (${current.severity ?? 'not set'} → ${input.severity})`);
        }
        if (
          input.latitude !== undefined &&
          input.longitude !== undefined &&
          (input.latitude !== current.latitude || input.longitude !== current.longitude)
        ) {
          changes.latitude = input.latitude;
          changes.longitude = input.longitude;
          changed.push('map location');
        }
        if (input.locationText !== undefined && input.locationText !== current.locationText) {
          changes.locationText = input.locationText;
          changed.push('location description');
        }
        if (changed.length === 0) return;

        await repository.updateDetails(db, id, changes);
        await repository.insertHistory(db, {
          incidentId: id,
          fromStatus: locked.status,
          toStatus: locked.status,
          changedBy: actor.id,
          note: `Details updated: ${changed.join(', ')}`,
        });
      });
      return getById(actor, id);
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
        if (!(PENDING_ASSIGNMENT_STATUSES as readonly string[]).includes(assignment.status)) {
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
     * The responder accepts an assignment (ASSIGNED → ACCEPTED), telling the
     * operators the unit has seen it and is getting ready. The incident's
     * status doesn't change; the acceptance appears in its timeline.
     */
    async accept(actor: AuthUser, assignmentId: string): Promise<IncidentWithActivity> {
      const found = await repository.findAssignment(pool, assignmentId);
      if (!found || found.responderId !== actor.id) throw AppError.notFound('Assignment not found');

      await withTransaction(pool, async (db) => {
        const incident = await lockIncident(db, found.incidentId);
        const assignment = await repository.findAssignment(db, assignmentId, { lock: true });
        if (!assignment || assignment.status !== 'ASSIGNED') {
          throw AppError.conflict('ASSIGNMENT_NOT_PENDING', 'This assignment has already been accepted or is no longer open');
        }

        await repository.markAssignmentAccepted(db, assignmentId);
        const [me] = await repository.findResponderCandidates(db, [actor.id]);
        await repository.insertHistory(db, {
          incidentId: incident.id,
          fromStatus: incident.status,
          toStatus: incident.status,
          changedBy: actor.id,
          note: `${me?.unitCode ?? actor.fullName} accepted the assignment`,
        });
      });
      return getById(actor, found.incidentId);
    },

    /**
     * A responder starts responding (from ASSIGNED or ACCEPTED). The first
     * responder to do so moves the incident from ASSIGNED to RESPONDING.
     */
    async respond(actor: AuthUser, assignmentId: string): Promise<IncidentWithActivity> {
      const found = await repository.findAssignment(pool, assignmentId);
      if (!found || found.responderId !== actor.id) throw AppError.notFound('Assignment not found');

      await withTransaction(pool, async (db) => {
        // Lock the incident first, then the assignment (same order everywhere, so no deadlocks)
        const incident = await lockIncident(db, found.incidentId);
        const assignment = await repository.findAssignment(db, assignmentId, { lock: true });
        if (!assignment || !(PENDING_ASSIGNMENT_STATUSES as readonly string[]).includes(assignment.status)) {
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

    /**
     * Adds a note to an open incident without changing its status, e.g.
     * "Arrived on scene, one lane closed". Assigned responders (while their
     * assignment is active) and operators can add notes. Notes appear in the
     * incident's timeline, which the reporting citizen also sees.
     */
    async addNote(actor: AuthUser, id: string, input: AddNoteInput): Promise<IncidentWithActivity> {
      if (actor.role === 'RESPONDER' && !(await repository.isAssignedResponder(pool, id, actor.id))) {
        throw AppError.notFound('Incident not found');
      }

      await withTransaction(pool, async (db) => {
        const incident = await lockIncident(db, id);

        if (incident.status === 'RESOLVED' || incident.status === 'REJECTED') {
          throw AppError.conflict('INCIDENT_CLOSED', `Notes can't be added to a ${incident.status.toLowerCase()} incident`);
        }
        if (actor.role === 'RESPONDER') {
          const active = await repository.listActiveAssignments(db, id);
          if (!active.some((assignment) => assignment.responderId === actor.id)) {
            throw AppError.forbidden('ASSIGNMENT_NOT_ACTIVE', 'You are no longer assigned to this incident');
          }
        }

        // A note is a timeline entry that keeps the status: from_status = to_status
        await repository.insertHistory(db, {
          incidentId: id,
          fromStatus: incident.status,
          toStatus: incident.status,
          changedBy: actor.id,
          note: input.note,
        });
      });
      return getById(actor, id);
    },

    /** The responder's own assignments: active ones, or finished ones for history. */
    listForResponder(actor: AuthUser, scope: 'active' | 'history'): Promise<ResponderAssignment[]> {
      const statuses =
        scope === 'active' ? (['ASSIGNED', 'ACCEPTED', 'RESPONDING'] as const) : (['COMPLETED', 'CANCELLED'] as const);
      return repository.listForResponder(pool, actor.id, statuses);
    },
  };

  /**
   * POST /incidents/:id/status: moves the incident to `input.status` using
   * the same rules as the dedicated endpoints (verify, reject, assign,
   * respond, resolve), so both ways of changing a status behave identically.
   */
  async function changeStatus(actor: AuthUser, id: string, input: StatusChangeInput): Promise<IncidentWithActivity> {
    // Roles that can never make this change are refused before anything is looked up
    if (!TRANSITIONS.some((t) => t.to === input.status && t.roles.includes(actor.role))) {
      throw AppError.forbidden(
        'TRANSITION_NOT_ALLOWED',
        `A ${actor.role.toLowerCase()} cannot move an incident to ${input.status}`,
      );
    }

    switch (input.status) {
      case 'VERIFIED':
        return service.verify(actor, id, { severity: input.severity, note: input.note });
      case 'REJECTED':
        return service.reject(actor, id, { reason: input.reason });
      case 'ASSIGNED': {
        // As a status change this is only VERIFIED → ASSIGNED. To add more
        // responders later, use POST /incidents/:id/assign.
        const current = await repository.findDetail(pool, id);
        if (!current) throw AppError.notFound('Incident not found');
        assertTransition(current.status, 'ASSIGNED', actor.role);
        return service.assign(actor, id, { responderIds: input.responderIds, notes: input.notes });
      }
      case 'RESPONDING': {
        const assignment = await repository.findActiveAssignmentFor(pool, id, actor.id);
        if (!assignment) {
          if (!(await repository.isAssignedResponder(pool, id, actor.id))) throw AppError.notFound('Incident not found');
          throw AppError.forbidden('ASSIGNMENT_NOT_ACTIVE', 'You are no longer assigned to this incident');
        }
        if (assignment.status === 'RESPONDING') {
          throw AppError.conflict('ALREADY_RESPONDING', 'You are already responding to this incident');
        }
        return service.respond(actor, assignment.id);
      }
      case 'RESOLVED':
        return service.resolve(actor, id, { resolutionNotes: input.resolutionNotes });
    }
  }

  return { ...service, changeStatus };
}

export type IncidentsService = ReturnType<typeof createIncidentsService>;
