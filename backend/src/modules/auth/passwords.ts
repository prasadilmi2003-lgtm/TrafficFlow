import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';

/**
 * Password hashing with bcrypt. bcryptjs is a pure-JavaScript
 * implementation of the same algorithm, so there is nothing to compile
 * natively on Windows, in Docker or in CI.
 *
 * The cost factor ("rounds") makes each hash deliberately slow, which makes
 * guessing passwords from a stolen database impractical. Tests use a low
 * cost so they run quickly.
 */
export function createPasswordHasher(rounds: number) {
  // A hash of a random value, compared against when an email address doesn't
  // exist, so a failed login takes the same time whether or not the account
  // exists (prevents discovering registered emails by timing).
  let dummyHash: Promise<string> | undefined;

  return {
    hash(password: string): Promise<string> {
      return bcrypt.hash(password, rounds);
    },

    verify(password: string, hash: string): Promise<boolean> {
      return bcrypt.compare(password, hash);
    },

    async verifyAgainstDummy(password: string): Promise<void> {
      dummyHash ??= bcrypt.hash(randomUUID(), rounds);
      await bcrypt.compare(password, await dummyHash);
    },
  };
}

export type PasswordHasher = ReturnType<typeof createPasswordHasher>;
