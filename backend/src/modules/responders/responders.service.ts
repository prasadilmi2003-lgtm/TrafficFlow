import { isUniqueViolation } from '../../db/errors.js';
import type { Pool } from '../../db/pool.js';
import type { AuthUser } from '../../types/domain.js';
import { AppError } from '../../utils/AppError.js';
import { countActiveAssignments } from '../users/users.repository.js';
import * as repository from './responders.repository.js';
import type { ResponderRecord } from './responders.repository.js';
import type { AvailabilityInput, ListRespondersQuery, UpdateResponderInput } from './responders.schemas.js';

export function createRespondersService({ pool }: { pool: Pool }) {
  async function load(userId: string): Promise<ResponderRecord> {
    const responder = await repository.findById(pool, userId);
    if (!responder) throw AppError.notFound('Responder not found');
    return responder;
  }

  async function assertNoActiveAssignments(userId: string, message: string): Promise<void> {
    if ((await countActiveAssignments(pool, userId)) > 0) {
      throw AppError.conflict('HAS_ACTIVE_ASSIGNMENTS', message);
    }
  }

  return {
    /** Operators use this list to pick responders; available ones come first. */
    list(query: ListRespondersQuery): Promise<ResponderRecord[]> {
      return repository.list(pool, {
        responderType: query.type,
        availability: query.availability,
        includeInactive: query.includeInactive,
      });
    },

    getOwnProfile(actor: AuthUser): Promise<ResponderRecord> {
      return load(actor.id);
    },

    /** Admin: change a responder's type, unit code or availability. */
    async update(userId: string, input: UpdateResponderInput): Promise<ResponderRecord> {
      await load(userId);
      if (input.availability && input.availability !== 'BUSY') {
        await assertNoActiveAssignments(userId, 'This responder is still working on an incident');
      }
      try {
        await repository.updateProfile(pool, userId, input);
      } catch (error) {
        if (isUniqueViolation(error, 'responder_profiles_unit_code_key')) {
          throw AppError.conflict('UNIT_CODE_TAKEN', `Unit code ${input.unitCode} is already in use`);
        }
        throw error;
      }
      return load(userId);
    },

    /** A responder going on duty (AVAILABLE) or off duty (OFF_DUTY). */
    async setOwnAvailability(actor: AuthUser, input: AvailabilityInput): Promise<ResponderRecord> {
      await assertNoActiveAssignments(actor.id, 'Finish or hand over your active assignments first');
      await repository.updateProfile(pool, actor.id, { availability: input.availability });
      return load(actor.id);
    },
  };
}

export type RespondersService = ReturnType<typeof createRespondersService>;
