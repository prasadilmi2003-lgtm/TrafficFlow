import { z } from 'zod';

/** Shared field rules, also used by the admin user-management endpoints. */
export const fields = {
  fullName: z.string().trim().min(2, 'Enter your full name').max(100, 'Name is too long'),

  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(255, 'Email address is too long')
    .pipe(z.email('Enter a valid email address')),

  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{7,20}$/, 'Enter a valid phone number')
    .nullish()
    .transform((value) => value || null),

  // bcrypt only uses the first 72 bytes of a password, so longer ones are rejected.
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password is too long')
    .refine((value) => /[A-Za-z]/.test(value) && /\d/.test(value), 'Password must contain letters and numbers'),
};

export const registerSchema = z.object({
  fullName: fields.fullName,
  email: fields.email,
  phone: fields.phone,
  password: fields.password,
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, 'Enter your email address'),
  password: z.string().min(1, 'Enter your password'),
});
export type LoginInput = z.infer<typeof loginSchema>;
