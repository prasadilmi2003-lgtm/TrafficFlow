import { isUniqueViolation } from '../../db/errors.js';
import type { Pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import type { AuthUser, Paginated } from '../../types/domain.js';
import { AppError } from '../../utils/AppError.js';
import { paginated } from '../../utils/pagination.js';
import type { PasswordHasher } from '../auth/passwords.js';
import * as repository from './users.repository.js';
import type { UserRecord } from './users.repository.js';
import type { CreateUserInput, ListUsersQuery, UpdateUserInput } from './users.schemas.js';

/** Admin user management. */
export function createUsersService({ pool, passwords }: { pool: Pool; passwords: PasswordHasher }) {
  async function load(id: string): Promise<UserRecord> {
    const user = await repository.findById(pool, id);
    if (!user) throw AppError.notFound('User not found');
    return user;
  }

  return {
    async list(query: ListUsersQuery): Promise<Paginated<UserRecord>> {
      const { items, total } = await repository.list(pool, query);
      return paginated(items, total, query);
    },

    get: load,

    async create(input: CreateUserInput): Promise<UserRecord> {
      const passwordHash = await passwords.hash(input.password);

      try {
        const id = await withTransaction(pool, async (db) => {
          const userId = await repository.insertUser(db, {
            fullName: input.fullName,
            email: input.email,
            phone: input.phone,
            passwordHash,
            role: input.role,
          });
          if (input.role === 'RESPONDER' && input.responderProfile) {
            await repository.insertResponderProfile(db, userId, input.responderProfile);
          }
          return userId;
        });
        return await load(id);
      } catch (error) {
        if (isUniqueViolation(error, 'users_email_lower_key')) {
          throw AppError.conflict('EMAIL_TAKEN', 'An account with this email address already exists');
        }
        if (isUniqueViolation(error, 'responder_profiles_unit_code_key')) {
          throw AppError.conflict('UNIT_CODE_TAKEN', `Unit code ${input.responderProfile?.unitCode} is already in use`);
        }
        throw error;
      }
    },

    /**
     * Rules that protect the system:
     * - admins can't deactivate themselves or remove their own admin role
     *   (so the last admin can't lock everyone out)
     * - accounts can't be switched to or from RESPONDER, because responders
     *   need a profile and may have assignments; create a new account instead
     * - responders with active assignments can't be deactivated
     */
    async update(actor: AuthUser, id: string, input: UpdateUserInput): Promise<UserRecord> {
      const user = await load(id);

      if (id === actor.id && (input.isActive === false || (input.role !== undefined && input.role !== 'ADMIN'))) {
        throw AppError.conflict('CANNOT_CHANGE_OWN_ACCESS', "You can't deactivate your own account or remove your own admin role");
      }
      if (input.role !== undefined && input.role !== user.role && (input.role === 'RESPONDER' || user.role === 'RESPONDER')) {
        throw AppError.conflict('ROLE_CHANGE_NOT_ALLOWED', 'Accounts cannot be changed to or from the responder role. Create a new account instead.');
      }
      if (input.isActive === false && user.role === 'RESPONDER' && (await repository.countActiveAssignments(pool, id)) > 0) {
        throw AppError.conflict('HAS_ACTIVE_ASSIGNMENTS', 'This responder is still assigned to an open incident');
      }

      await repository.updateUser(pool, id, {
        fullName: input.fullName,
        phone: input.phone,
        role: input.role,
        isActive: input.isActive,
        passwordHash: input.password ? await passwords.hash(input.password) : undefined,
      });
      return load(id);
    },
  };
}

export type UsersService = ReturnType<typeof createUsersService>;
