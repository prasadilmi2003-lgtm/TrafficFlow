import { describe, expect, it } from 'vitest';
import { loginSchema, registerSchema } from '../src/modules/auth/auth.schemas.js';

describe('registerSchema', () => {
  const valid = { fullName: ' Ayesha Fernando ', email: ' Ayesha@Example.COM ', password: 'secret123' };

  it('trims the name and normalises the email to lower case', () => {
    expect(registerSchema.parse(valid)).toEqual({
      fullName: 'Ayesha Fernando',
      email: 'ayesha@example.com',
      phone: null,
      password: 'secret123',
    });
  });

  it('rejects weak passwords', () => {
    expect(registerSchema.safeParse({ ...valid, password: 'short1' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, password: 'onlyletters' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, password: '12345678' }).success).toBe(false);
  });

  it('rejects passwords longer than bcrypt can use (72 bytes)', () => {
    expect(registerSchema.safeParse({ ...valid, password: `a1${'x'.repeat(71)}` }).success).toBe(false);
  });

  it('ignores a role sent by the client (registration always creates a citizen)', () => {
    const parsed = registerSchema.parse({ ...valid, role: 'ADMIN' });
    expect('role' in parsed).toBe(false);
  });
});

describe('loginSchema', () => {
  it('normalises the email so login is not case-sensitive', () => {
    expect(loginSchema.parse({ email: ' Ayesha@Example.COM ', password: 'secret123' })).toEqual({
      email: 'ayesha@example.com',
      password: 'secret123',
    });
  });

  it('requires both fields', () => {
    expect(loginSchema.safeParse({ email: '', password: 'secret123' }).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'a@b.com' }).success).toBe(false);
  });
});
