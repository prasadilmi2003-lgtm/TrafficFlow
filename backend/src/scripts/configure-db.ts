/**
 * Sets up the database connection in backend/.env, interactively:
 *
 *   npm run db:configure
 *
 * It asks for the PostgreSQL host, port, database, user and password (the
 * password is not shown while you type), checks that PostgreSQL accepts
 * them, offers to create the database and the test database if they don't
 * exist, and saves DATABASE_URL (and TEST_DATABASE_URL) in backend/.env with
 * the password correctly URL-encoded. Nothing is saved until the connection
 * works, and the password is never printed.
 */
import { randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import pg from 'pg';
import { loadEnvFile } from '../config/env.js';
import {
  buildDatabaseUrl,
  isSimpleDatabaseName,
  readConnectionParts,
  setEnvValue,
  type ConnectionParts,
} from '../db/connectionString.js';
import { explainDatabaseError } from '../db/errors.js';

const ENV_FILE = '.env';
const ENV_EXAMPLE = '.env.example';
const MAX_PASSWORD_ATTEMPTS = 3;

/** Terminal output that can be switched off while the password is typed, so it isn't echoed. */
class MutableOutput extends Writable {
  muted = false;

  override _write(chunk: Buffer | string, encoding: BufferEncoding, callback: () => void): void {
    if (!this.muted) process.stdout.write(chunk, encoding);
    callback();
  }
}

const output = new MutableOutput();
const terminal = Boolean(process.stdin.isTTY);
const rl = createInterface({ input: process.stdin, output, terminal });

/** The server being set up, without a password: used in error messages. */
let target = '';

async function ask(question: string, fallback: string): Promise<string> {
  const answer = (await rl.question(`${question} [${fallback}]: `)).trim();
  return answer || fallback;
}

async function askYesNo(question: string): Promise<boolean> {
  const answer = (await rl.question(`${question} [Y/n]: `)).trim().toLowerCase();
  return answer === '' || answer === 'y' || answer === 'yes';
}

async function askPassword(question: string): Promise<string> {
  output.write(question);
  output.muted = true;
  const answer = await rl.question('');
  output.muted = false;
  output.write('\n');
  return answer;
}

function errorCode(error: unknown): string | undefined {
  const code = typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined;
  return typeof code === 'string' ? code : undefined;
}

/** Connects once and returns the server version, or throws the connection error. */
async function tryConnect(url: string): Promise<string> {
  const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 5_000 });
  try {
    await client.connect();
    const { rows } = await client.query<{ version: string }>("SELECT current_setting('server_version') AS version");
    return rows[0]?.version ?? 'unknown';
  } finally {
    await client.end().catch(() => undefined);
  }
}

/** Creates `database` using the "postgres" maintenance database, unless it already exists. */
async function ensureDatabase(parts: ConnectionParts, database: string): Promise<'created' | 'exists'> {
  if (!isSimpleDatabaseName(database)) {
    throw new Error(`"${database}" is not a simple database name (use letters, numbers and underscores)`);
  }
  const client = new pg.Client({
    connectionString: buildDatabaseUrl({ ...parts, database: 'postgres' }),
    connectionTimeoutMillis: 5_000,
  });
  try {
    await client.connect();
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [database]);
    if (rowCount) return 'exists';
    // Identifiers can't be query parameters; the name was checked above.
    await client.query(`CREATE DATABASE "${database}"`);
    return 'created';
  } finally {
    await client.end().catch(() => undefined);
  }
}

/** backend/.env, created from .env.example (with a fresh JWT_SECRET) if it doesn't exist yet. */
function readOrCreateEnvFile(): string {
  if (!existsSync(ENV_FILE)) {
    if (existsSync(ENV_EXAMPLE)) {
      copyFileSync(ENV_EXAMPLE, ENV_FILE);
      console.log(`Created ${ENV_FILE} from ${ENV_EXAMPLE}.`);
    } else {
      writeFileSync(ENV_FILE, '');
    }
  }
  let content = readFileSync(ENV_FILE, 'utf8');
  const jwtLine = /^\s*JWT_SECRET\s*=\s*(\S*)/m.exec(content);
  if (!jwtLine || jwtLine[1] === '') {
    content = setEnvValue(content, 'JWT_SECRET', randomBytes(48).toString('base64url'));
    console.log('Generated a new JWT_SECRET.');
  }
  return content;
}

async function main(): Promise<void> {
  const overridden = loadEnvFile(ENV_FILE);
  const current = readConnectionParts(process.env.DATABASE_URL);

  console.log('TrafficFlow database setup');
  console.log('Saves the PostgreSQL connection in backend/.env. Press Enter to keep the value in [brackets].\n');
  if (!terminal) {
    console.log('Note: this terminal cannot hide typing, so your password will be visible while you type it.\n');
  }

  const host = await ask('Host', current?.host ?? 'localhost');
  const port = Number(await ask('Port', String(current?.port ?? 5432)));
  if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error('The port must be a number between 1 and 65535');
  const database = await ask('Database', current?.database ?? 'trafficflow');
  const user = await ask('User', current?.user ?? 'postgres');
  target = buildDatabaseUrl({ host, port, user, password: '', database });

  let parts: ConnectionParts | undefined;
  for (let attempt = 1; attempt <= MAX_PASSWORD_ATTEMPTS && !parts; attempt++) {
    const password = await askPassword(`Password for PostgreSQL user "${user}" (not shown): `);
    const candidate: ConnectionParts = { host, port, user, password, database };
    const url = buildDatabaseUrl(candidate);

    try {
      const version = await tryConnect(url);
      console.log(`Connected to PostgreSQL ${version} as ${user}.`);
      parts = candidate;
    } catch (error) {
      const code = errorCode(error);
      if (code === '28P01') {
        console.log(`PostgreSQL rejected that password for "${user}".${attempt < MAX_PASSWORD_ATTEMPTS ? ' Try again.' : ''}`);
        continue;
      }
      if (code === '3D000') {
        console.log(`The database "${database}" does not exist yet.`);
        if (!(await askYesNo(`Create "${database}" now?`))) throw new Error('Create the database first, then run this again.');
        await ensureDatabase(candidate, database);
        console.log(`Created database "${database}".`);
        await tryConnect(url);
        parts = candidate;
        continue;
      }
      throw error;
    }
  }
  if (!parts) throw new Error('Too many wrong passwords. Nothing was changed.');

  let content = readOrCreateEnvFile();
  content = setEnvValue(content, 'DATABASE_URL', buildDatabaseUrl(parts));
  const saved = ['DATABASE_URL'];

  const testDatabase = `${database}_test`;
  if (await askYesNo(`Also set up "${testDatabase}" for the integration tests (npm test wipes and reuses it)?`)) {
    const result = await ensureDatabase(parts, testDatabase);
    console.log(result === 'created' ? `Created database "${testDatabase}".` : `Database "${testDatabase}" already exists.`);
    content = setEnvValue(content, 'TEST_DATABASE_URL', buildDatabaseUrl({ ...parts, database: testDatabase }));
    saved.push('TEST_DATABASE_URL');
  }

  writeFileSync(ENV_FILE, content);
  console.log(`\nSaved ${saved.join(' and ')} in backend/.env (the password is URL-encoded and not shown here).`);

  if (overridden.includes('DATABASE_URL')) {
    console.log(
      '\nWARNING: DATABASE_URL is also set in your system environment, and that value wins over backend/.env.\n' +
        'Remove it (Windows: System Properties > Environment Variables), or for this PowerShell window run:\n' +
        '  Remove-Item Env:DATABASE_URL',
    );
  }
  console.log('\nNext: npm run db:migrate');
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n${explainDatabaseError(error, target) ?? message}`);
    process.exitCode = 1;
  })
  .finally(() => rl.close());
