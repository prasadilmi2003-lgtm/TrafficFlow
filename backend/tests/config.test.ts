import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig, loadDatabaseConfig } from '../src/config/env.js';

/** The two variables that have no default */
const REQUIRED = {
  DATABASE_URL: 'postgres://trafficflow:secret@localhost:5432/trafficflow',
  JWT_SECRET: 'a-test-secret-that-is-at-least-32-characters',
};

/** Returns the problems reported for an invalid environment. */
function problemsFor(env: Record<string, string>): string[] {
  try {
    loadConfig(env);
  } catch (error) {
    if (error instanceof ConfigError) return error.problems;
    throw error;
  }
  throw new Error('Expected loadConfig to reject this environment');
}

describe('loadConfig', () => {
  it('uses safe defaults for everything except the database URL and JWT secret', () => {
    const config = loadConfig(REQUIRED);

    expect(config).toMatchObject({
      env: 'development',
      isProduction: false,
      port: 4000,
      logLevel: 'info',
      trustProxy: 0,
      rateLimit: { windowMs: 900_000, max: 1000, authMax: 10 },
      appVersion: 'dev',
      database: { url: REQUIRED.DATABASE_URL, poolMax: 10 },
      auth: { jwtExpiresInSeconds: 8 * 3600, cookieSecure: false, bcryptRounds: 12 },
    });
  });

  it('requires DATABASE_URL and JWT_SECRET', () => {
    const problems = problemsFor({});

    expect(problems).toHaveLength(2);
    expect(problems.some((p) => p.startsWith('DATABASE_URL: '))).toBe(true);
    expect(problems.some((p) => p.startsWith('JWT_SECRET: '))).toBe(true);
  });

  it('reads values from the environment and converts them', () => {
    const config = loadConfig({
      ...REQUIRED,
      NODE_ENV: 'production',
      PORT: '8080',
      LOG_LEVEL: 'warn',
      TRUST_PROXY: '1',
      RATE_LIMIT_MAX: '50',
      APP_VERSION: '3f9c2e1',
      JWT_EXPIRES_IN: '30m',
      COOKIE_SECURE: 'true',
    });

    expect(config).toMatchObject({
      env: 'production',
      isProduction: true,
      port: 8080,
      logLevel: 'warn',
      trustProxy: 1,
      rateLimit: { max: 50 },
      appVersion: '3f9c2e1',
      auth: { jwtExpiresInSeconds: 1800, cookieSecure: true },
    });
  });

  it('treats empty values as not set', () => {
    expect(loadConfig({ ...REQUIRED, PORT: '', LOG_LEVEL: '  ' })).toMatchObject({ port: 4000, logLevel: 'info' });
  });

  it('rejects a port outside 1-65535', () => {
    const problems = problemsFor({ ...REQUIRED, PORT: '70000' });

    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/^PORT: /);
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(problemsFor({ ...REQUIRED, NODE_ENV: 'staging' })[0]).toMatch(/^NODE_ENV: /);
  });

  it('rejects values that are not numbers', () => {
    expect(problemsFor({ ...REQUIRED, RATE_LIMIT_MAX: 'lots' })[0]).toMatch(/^RATE_LIMIT_MAX: /);
  });

  it('rejects a JWT secret shorter than 32 characters', () => {
    expect(problemsFor({ ...REQUIRED, JWT_SECRET: 'too-short' })[0]).toMatch(/^JWT_SECRET: /);
  });

  it('rejects a database URL that is not a PostgreSQL connection string', () => {
    expect(problemsFor({ ...REQUIRED, DATABASE_URL: 'mysql://localhost/db' })[0]).toMatch(/^DATABASE_URL: /);
  });

  it('rejects an invalid token lifetime', () => {
    expect(problemsFor({ ...REQUIRED, JWT_EXPIRES_IN: '8 hours' })[0]).toMatch(/^JWT_EXPIRES_IN: /);
  });

  it('reports every problem at once', () => {
    const problems = problemsFor({ ...REQUIRED, PORT: 'abc', NODE_ENV: 'staging', LOG_LEVEL: 'loud' });

    expect(problems).toHaveLength(3);
  });

  it('returns a configuration that cannot be changed at runtime', () => {
    const config = loadConfig(REQUIRED);

    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.rateLimit)).toBe(true);
    expect(Object.isFrozen(config.auth)).toBe(true);
  });
});

describe('loadDatabaseConfig', () => {
  it('needs only DATABASE_URL (used by the migration script)', () => {
    expect(loadDatabaseConfig({ DATABASE_URL: REQUIRED.DATABASE_URL })).toEqual({
      url: REQUIRED.DATABASE_URL,
      poolMax: 10,
    });
  });
});
