import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../src/config/env.js';

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
  it('uses safe defaults when nothing is set', () => {
    expect(loadConfig({})).toEqual({
      env: 'development',
      isProduction: false,
      port: 4000,
      logLevel: 'info',
      trustProxy: 0,
      rateLimit: { windowMs: 900_000, max: 300 },
      appVersion: 'dev',
    });
  });

  it('reads values from the environment and converts numbers', () => {
    const config = loadConfig({
      NODE_ENV: 'production',
      PORT: '8080',
      LOG_LEVEL: 'warn',
      TRUST_PROXY: '1',
      RATE_LIMIT_MAX: '50',
      APP_VERSION: '3f9c2e1',
    });

    expect(config).toMatchObject({
      env: 'production',
      isProduction: true,
      port: 8080,
      logLevel: 'warn',
      trustProxy: 1,
      rateLimit: { max: 50 },
      appVersion: '3f9c2e1',
    });
  });

  it('treats empty values as not set', () => {
    expect(loadConfig({ PORT: '', LOG_LEVEL: '  ' })).toMatchObject({ port: 4000, logLevel: 'info' });
  });

  it('rejects a port outside 1-65535', () => {
    const problems = problemsFor({ PORT: '70000' });

    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/^PORT: /);
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(problemsFor({ NODE_ENV: 'staging' })[0]).toMatch(/^NODE_ENV: /);
  });

  it('rejects values that are not numbers', () => {
    expect(problemsFor({ RATE_LIMIT_MAX: 'lots' })[0]).toMatch(/^RATE_LIMIT_MAX: /);
  });

  it('reports every problem at once', () => {
    const problems = problemsFor({ PORT: 'abc', NODE_ENV: 'staging', LOG_LEVEL: 'loud' });

    expect(problems).toHaveLength(3);
  });

  it('returns a configuration that cannot be changed at runtime', () => {
    const config = loadConfig({});

    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.rateLimit)).toBe(true);
  });
});
