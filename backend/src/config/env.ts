import { z } from 'zod';

/** Name used in logs and in the health response. */
export const SERVICE_NAME = 'trafficflow-backend';

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];
export type NodeEnv = 'development' | 'test' | 'production';

/**
 * Every environment variable the backend reads, with its type, allowed values
 * and default. When a later phase needs a new variable, add it here and to
 * .env.example.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  APP_VERSION: z.string().trim().min(1).max(64).default('dev'),
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
    readonly max: number;
  };
  readonly appVersion: string;
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

/**
 * Reads configuration from environment variables and validates it.
 *
 * Throws a ConfigError listing every problem at once, so the server can refuse
 * to start with a clear message instead of failing later in a confusing way.
 *
 * @param source defaults to process.env; tests pass their own values
 */
export function loadConfig(source: EnvSource = process.env): AppConfig {
  // Treat empty values (for example "PORT=") as not set, so the default applies.
  const values = Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== undefined && value.trim() !== ''),
  );

  const result = envSchema.safeParse(values);

  if (!result.success) {
    const problems = result.error.issues.map((issue) => {
      const variable = issue.path.map(String).join('.') || '(environment)';
      return `${variable}: ${issue.message}`;
    });
    throw new ConfigError(problems);
  }

  const env = result.data;

  return Object.freeze({
    env: env.NODE_ENV,
    isProduction: env.NODE_ENV === 'production',
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
    trustProxy: env.TRUST_PROXY,
    rateLimit: Object.freeze({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      max: env.RATE_LIMIT_MAX,
    }),
    appVersion: env.APP_VERSION,
  });
}
