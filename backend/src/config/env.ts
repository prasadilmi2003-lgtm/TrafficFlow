import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

/** Name used in logs and in the health response. */
export const SERVICE_NAME = 'trafficflow-backend';

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];
export type NodeEnv = 'development' | 'test' | 'production';

// Durations such as "30m", "8h" or "7d"
const DURATION = /^(\d+)([smhd])$/;
const SECONDS_PER_UNIT = { s: 1, m: 60, h: 3600, d: 86_400 } as const;

function durationToSeconds(value: string): number {
  const [, amount = '0', unit = 's'] = DURATION.exec(value) ?? [];
  return Number(amount) * SECONDS_PER_UNIT[unit as keyof typeof SECONDS_PER_UNIT];
}

/** Variables needed by anything that talks to PostgreSQL, including the migration script. */
const databaseSchema = z.object({
  DATABASE_URL: z
    .string('is required: set it in backend/.env (see .env.example)')
    .regex(
      /^postgres(ql)?:\/\/.+/,
      'must be a PostgreSQL connection string, e.g. postgres://user:password@localhost:5432/trafficflow',
    ),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
});

/**
 * Every environment variable the API reads, with its type, allowed values
 * and default. When a feature needs a new variable, add it here and to
 * .env.example.
 */
const envSchema = databaseSchema.extend({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(1000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  APP_VERSION: z.string().trim().min(1).max(64).default('dev'),

  JWT_SECRET: z
    .string('is required: set it in backend/.env (see .env.example for how to generate one)')
    .min(32, 'must be at least 32 characters long. Generate one with the command in backend/README.md'),
  JWT_EXPIRES_IN: z
    .string()
    .regex(DURATION, 'must be a number followed by s, m, h or d, for example 8h')
    .default('8h')
    .transform(durationToSeconds),
  COOKIE_SECURE: z.stringbool().default(false),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),

  UPLOAD_DIR: z.string().trim().min(1).default('uploads'),
  MAX_UPLOAD_SIZE_MB: z.coerce.number().int().min(1).max(20).default(5),
});

/** Validated, typed configuration used by the rest of the application. */
export interface AppConfig {
  readonly env: NodeEnv;
  readonly isProduction: boolean;
  readonly port: number;
  readonly logLevel: LogLevel;
  /** Number of reverse proxies in front of the API (0 locally, 1 behind Nginx). */
  readonly trustProxy: number;
  readonly rateLimit: {
    readonly windowMs: number;
    /** Requests per client IP per window on /api/v1 */
    readonly max: number;
    /** Failed login/registration attempts per client IP per window */
    readonly authMax: number;
  };
  readonly appVersion: string;
  readonly database: DatabaseConfig;
  readonly auth: {
    readonly jwtSecret: string;
    readonly jwtExpiresInSeconds: number;
    /** Send the session cookie only over HTTPS */
    readonly cookieSecure: boolean;
    readonly bcryptRounds: number;
  };
  readonly uploads: {
    /** Absolute path of the folder where incident photos are stored */
    readonly dir: string;
    readonly maxSizeBytes: number;
  };
}

export interface DatabaseConfig {
  readonly url: string;
  readonly poolMax: number;
}

/** Thrown when one or more environment variables are missing or invalid. */
export class ConfigError extends Error {
  readonly problems: string[];

  constructor(problems: string[]) {
    super(`Invalid environment configuration:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'ConfigError';
    this.problems = problems;
  }
}

type EnvSource = Record<string, string | undefined>;

/** Validates `source` against `schema`, throwing a ConfigError that lists every problem. */
function parseEnv<T extends z.ZodType>(schema: T, source: EnvSource): z.output<T> {
  // Treat empty values (for example "PORT=") as not set, so the default applies.
  const values = Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== undefined && value.trim() !== ''),
  );

  const result = schema.safeParse(values);

  if (!result.success) {
    const problems = result.error.issues.map((issue) => {
      const variable = issue.path.map(String).join('.') || '(environment)';
      return `${variable}: ${issue.message}`;
    });
    throw new ConfigError(problems);
  }

  return result.data;
}

/**
 * Reads the API configuration from environment variables and validates it,
 * so the server can refuse to start with a clear message instead of failing
 * later in a confusing way.
 *
 * @param source defaults to process.env; tests pass their own values
 */
export function loadConfig(source: EnvSource = process.env): AppConfig {
  const env = parseEnv(envSchema, source);

  return Object.freeze({
    env: env.NODE_ENV,
    isProduction: env.NODE_ENV === 'production',
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
    trustProxy: env.TRUST_PROXY,
    rateLimit: Object.freeze({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      max: env.RATE_LIMIT_MAX,
      authMax: env.AUTH_RATE_LIMIT_MAX,
    }),
    appVersion: env.APP_VERSION,
    database: Object.freeze({ url: env.DATABASE_URL, poolMax: env.DATABASE_POOL_MAX }),
    auth: Object.freeze({
      jwtSecret: env.JWT_SECRET,
      jwtExpiresInSeconds: env.JWT_EXPIRES_IN,
      cookieSecure: env.COOKIE_SECURE,
      bcryptRounds: env.BCRYPT_ROUNDS,
    }),
    uploads: Object.freeze({
      dir: resolve(env.UPLOAD_DIR),
      maxSizeBytes: env.MAX_UPLOAD_SIZE_MB * 1024 * 1024,
    }),
  });
}

/** Reads only the database settings (used by the migration and seed scripts). */
export function loadDatabaseConfig(source: EnvSource = process.env): DatabaseConfig {
  const env = parseEnv(databaseSchema, source);
  return Object.freeze({ url: env.DATABASE_URL, poolMax: env.DATABASE_POOL_MAX });
}

/**
 * Loads backend/.env during local development. Variables that are already
 * set (for example by Docker Compose) are not overwritten.
 */
export function loadEnvFile(path = '.env'): void {
  if (existsSync(path)) {
    process.loadEnvFile(path);
  }
}
