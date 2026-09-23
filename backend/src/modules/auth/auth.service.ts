import { isUniqueViolation } from '../../db/errors.js';
import type { Pool } from '../../db/pool.js';
import type { AuthUser } from '../../types/domain.js';
import { AppError } from '../../utils/AppError.js';
import * as users from '../users/users.repository.js';
import type { UserRecord } from '../users/users.repository.js';
import type { LoginInput, RegisterInput } from './auth.schemas.js';
import type { PasswordHasher } from './passwords.js';

export function createAuthService({ pool, passwords }: { pool: Pool; passwords: PasswordHasher }) {
  async function loadUser(id: string): Promise<UserRecord> {
    const user = await users.findById(pool, id);
    if (!user) throw AppError.unauthorized();
    return user;
  }

  return {
    /** Public self-registration. Always creates a CITIZEN account. */
    async register(input: RegisterInput): Promise<UserRecord> {
      const passwordHash = await passwords.hash(input.password);
      try {
        const id = await users.insertUser(pool, {
          fullName: input.fullName,
          email: input.email,
          phone: input.phone,
          passwordHash,
          role: 'CITIZEN',
        });
        return await loadUser(id);
      } catch (error) {
        if (isUniqueViolation(error, 'users_email_lower_key')) {
          throw AppError.conflict('EMAIL_TAKEN', 'An account with this email address already exists');
        }
        throw error;
      }
    },

    async login(input: LoginInput): Promise<UserRecord> {
      const credentials = await users.findCredentialsByEmail(pool, input.email);

      if (!credentials) {
        await passwords.verifyAgainstDummy(input.password);
        throw AppError.unauthorized('INVALID_CREDENTIALS', 'Incorrect email or password');
      }
      if (!(await passwords.verify(input.password, credentials.passwordHash))) {
        throw AppError.unauthorized('INVALID_CREDENTIALS', 'Incorrect email or password');
      }
      if (!credentials.isActive) {
        throw AppError.forbidden('ACCOUNT_DISABLED', 'This account has been deactivated. Contact an administrator.');
      }

      await users.recordLogin(pool, credentials.id);
      return loadUser(credentials.id);
    },

    currentUser(user: AuthUser): Promise<UserRecord> {
      return loadUser(user.id);
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
