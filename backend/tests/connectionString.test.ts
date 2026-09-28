import pg from 'pg';
import { describe, expect, it } from 'vitest';
import { buildDatabaseUrl, isSimpleDatabaseName, readConnectionParts, setEnvValue } from '../src/db/connectionString.js';

const PARTS = { host: 'localhost', port: 5432, user: 'postgres', database: 'trafficflow' };

describe('buildDatabaseUrl', () => {
  it('URL-encodes passwords with special characters so pg reads them back unchanged', () => {
    for (const password of ['p@ss:w/rd#1', '100% sure', 'quote"s and \'single\'', 'ünïcödé', 'a+b=c?d&e']) {
      const url = buildDatabaseUrl({ ...PARTS, password });
      expect(url).toMatch(/^postgres:\/\/postgres:[^@]+@localhost:5432\/trafficflow$/);
      // How pg itself reads the connection string (creating a client doesn't connect)
      const client = new pg.Client({ connectionString: url });
      expect({ user: client.user, password: client.password, host: client.host, port: client.port, database: client.database }).toEqual({
        user: 'postgres',
        password,
        host: 'localhost',
        port: 5432,
        database: 'trafficflow',
      });
    }
  });

  it('leaves the password out when there is none', () => {
    expect(buildDatabaseUrl({ ...PARTS, password: '' })).toBe('postgres://postgres@localhost:5432/trafficflow');
  });

  it('brackets IPv6 hosts', () => {
    expect(buildDatabaseUrl({ ...PARTS, host: '::1', password: 'x' })).toBe('postgres://postgres:x@[::1]:5432/trafficflow');
  });
});

describe('readConnectionParts', () => {
  it('reads everything except the password', () => {
    const parts = readConnectionParts('postgres://app%40user:secret@db.example:5433/tf_test');
    expect(parts).toEqual({ host: 'db.example', port: 5433, user: 'app@user', database: 'tf_test' });
    expect(JSON.stringify(parts)).not.toContain('secret');
  });

  it('returns undefined for missing or invalid values', () => {
    expect(readConnectionParts(undefined)).toBeUndefined();
    expect(readConnectionParts('not a url')).toBeUndefined();
    expect(readConnectionParts('mysql://localhost/db')).toBeUndefined();
  });
});

describe('setEnvValue', () => {
  it('replaces the existing line and keeps every other line and comment', () => {
    const before = '# Database\nDATABASE_URL=postgres://old\nJWT_SECRET=abc\n';
    expect(setEnvValue(before, 'DATABASE_URL', 'postgres://new')).toBe('# Database\nDATABASE_URL=postgres://new\nJWT_SECRET=abc\n');
  });

  it('adds a missing variable at the end', () => {
    expect(setEnvValue('A=1\n', 'B', '2')).toBe('A=1\nB=2\n');
    expect(setEnvValue('', 'B', '2')).toBe('B=2\n');
  });

  it('removes duplicates of the variable and leaves commented-out lines alone', () => {
    const before = '# DATABASE_URL=example\nDATABASE_URL=one\nX=1\nDATABASE_URL=two\n';
    expect(setEnvValue(before, 'DATABASE_URL', 'new')).toBe('# DATABASE_URL=example\nDATABASE_URL=new\nX=1\n');
  });

  it('keeps Windows line endings', () => {
    expect(setEnvValue('A=1\r\nB=2\r\n', 'A', '3')).toBe('A=3\r\nB=2\r\n');
  });

  it('does not touch variables whose names only start the same way', () => {
    expect(setEnvValue('DATABASE_URL_OLD=x\n', 'DATABASE_URL', 'y')).toBe('DATABASE_URL_OLD=x\nDATABASE_URL=y\n');
  });
});

describe('isSimpleDatabaseName', () => {
  it('accepts plain names and refuses anything that would need quoting', () => {
    expect(isSimpleDatabaseName('trafficflow_test')).toBe(true);
    expect(isSimpleDatabaseName('traffic-flow')).toBe(false);
    expect(isSimpleDatabaseName('x"; DROP DATABASE y; --')).toBe(false);
  });
});
