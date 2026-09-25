import { isUniqueViolation } from '../../db/errors.js';
import type { Pool } from '../../db/pool.js';
import { AppError } from '../../utils/AppError.js';
import * as repository from './incidentTypes.repository.js';
import type { IncidentType } from './incidentTypes.repository.js';
import type { CreateIncidentTypeInput, UpdateIncidentTypeInput } from './incidentTypes.schemas.js';

export function createIncidentTypesService({ pool }: { pool: Pool }) {
  return {
    /** Types citizens can choose when reporting */
    listActive(): Promise<IncidentType[]> {
      return repository.list(pool, { activeOnly: true });
    },

    listAll(): Promise<IncidentType[]> {
      return repository.list(pool, { activeOnly: false });
    },

    async create(input: CreateIncidentTypeInput): Promise<IncidentType> {
      try {
        return await repository.insert(pool, input);
      } catch (error) {
        if (isUniqueViolation(error, 'incident_types_code_key')) {
          throw AppError.conflict('CODE_TAKEN', `An incident type with code ${input.code} already exists`);
        }
        throw error;
      }
    },

    /** Types are deactivated rather than deleted, because existing incidents refer to them. */
    async update(id: string, input: UpdateIncidentTypeInput): Promise<IncidentType> {
      const updated = await repository.update(pool, id, input);
      if (!updated) throw AppError.notFound('Incident type not found');
      return updated;
    },
  };
}

export type IncidentTypesService = ReturnType<typeof createIncidentTypesService>;
