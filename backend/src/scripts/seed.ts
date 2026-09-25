/**
 * Seeds the database.
 *
 *   npm run db:seed              create the first admin account
 *   npm run db:seed -- --demo    also create demo accounts and incidents
 *
 * The compiled version (node dist/scripts/seed.js, or npm run db:seed:prod)
 * is what Docker runs, where tsx isn't installed.
 *
 * Environment variables (from the environment or backend/.env):
 *   ADMIN_PASSWORD        required: password for the admin account
 *   ADMIN_EMAIL           default admin@trafficflow.local
 *   ADMIN_NAME            default System Administrator
 *   DEMO_USER_PASSWORD    password for every demo account (--demo only)
 *
 * Safe to run more than once: existing accounts are left unchanged, and demo
 * incidents are only created when the database has no incidents yet.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { ConfigError, loadDatabaseConfig, loadEnvFile } from '../config/env.js';
import { explainDatabaseError } from '../db/errors.js';
import { createPool, type Pool } from '../db/pool.js';
import { withTransaction } from '../db/transaction.js';
import { fields } from '../modules/auth/auth.schemas.js';
import { createPasswordHasher, type PasswordHasher } from '../modules/auth/passwords.js';
import { createIncidentsService } from '../modules/incidents/incidents.service.js';
import * as incidentTypes from '../modules/incidentTypes/incidentTypes.repository.js';
import * as users from '../modules/users/users.repository.js';
import { INCIDENT_STATUSES, RESPONDER_TYPES, ROLES, SEVERITIES, type AuthUser } from '../types/domain.js';
import { createLogger } from '../utils/logger.js';

const DEMO_DATA_FILE = fileURLToPath(new URL('../../../database/seeds/demo-data.json', import.meta.url));

const seedEnvSchema = z.object({
  ADMIN_NAME: fields.fullName.default('System Administrator'),
  ADMIN_EMAIL: fields.email.default('admin@trafficflow.local'),
  ADMIN_PASSWORD: z.string('is required: set the admin password in backend/.env').pipe(fields.password),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
  DEMO_USER_PASSWORD: fields.password.optional(),
});

const demoDataSchema = z.object({
  users: z.array(
    z.object({
      fullName: z.string(),
      email: z.string(),
      phone: z.string().nullable().default(null),
      role: z.enum(ROLES),
      responder: z.object({ responderType: z.enum(RESPONDER_TYPES), unitCode: z.string() }).optional(),
    }),
  ),
  incidents: z.array(
    z.object({
      reporter: z.string(),
      type: z.string(),
      description: z.string(),
      latitude: z.number(),
      longitude: z.number(),
      locationText: z.string().nullable().default(null),
      target: z.enum(INCIDENT_STATUSES),
      severity: z.enum(SEVERITIES).optional(),
      responders: z.array(z.string()).default([]),
      rejectionReason: z.string().optional(),
      resolutionNotes: z.string().optional(),
    }),
  ),
});

type SeedEnv = z.infer<typeof seedEnvSchema>;

function readSeedEnv(): SeedEnv {
  const values = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined && v.trim() !== ''));
  const result = seedEnvSchema.safeParse(values);
  if (!result.success) {
    throw new ConfigError(result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`));
  }
  return result.data;
}

/** Creates the account unless one with this email already exists. Returns its id. */
async function ensureUser(
  pool: Pool,
  passwords: PasswordHasher,
  user: { fullName: string; email: string; phone: string | null; role: AuthUser['role'] },
  password: string,
  responder?: { responderType: (typeof RESPONDER_TYPES)[number]; unitCode: string },
): Promise<{ id: string; created: boolean }> {
  const existing = await users.findCredentialsByEmail(pool, user.email);
  if (existing) return { id: existing.id, created: false };

  const passwordHash = await passwords.hash(password);
  const id = await withTransaction(pool, async (db) => {
    const userId = await users.insertUser(db, { ...user, passwordHash });
    if (responder) await users.insertResponderProfile(db, userId, responder);
    return userId;
  });
  return { id, created: true };
}

async function seedDemo(pool: Pool, passwords: PasswordHasher, demoPassword: string): Promise<void> {
  const data = demoDataSchema.parse(JSON.parse(await readFile(DEMO_DATA_FILE, 'utf8')));

  // 1. Accounts
  const accounts = new Map<string, AuthUser>();
  const unitToUserId = new Map<string, string>();
  for (const user of data.users) {
    const { id, created } = await ensureUser(pool, passwords, user, demoPassword, user.responder);
    accounts.set(user.email, { id, fullName: user.fullName, email: user.email, role: user.role });
    if (user.responder) unitToUserId.set(user.responder.unitCode, id);
    console.log(`  ${created ? 'Created' : 'Exists '} ${user.role.padEnd(9)} ${user.email}`);
  }

  // 2. Incidents, created through the real service so every status change
  //    goes through the lifecycle rules and gets a history entry.
  const { rows } = await pool.query<{ count: number }>('SELECT count(*)::int AS count FROM incidents');
  if ((rows[0]?.count ?? 0) > 0) {
    console.log('  Incidents already exist, skipping demo incidents.');
    return;
  }

  const logger = createLogger({ logLevel: 'warn', appVersion: 'seed' });
  const service = createIncidentsService({ pool, logger, uploadDir: '.' });
  const types = await incidentTypes.list(pool, { activeOnly: true });
  const operator = [...accounts.values()].find((account) => account.role === 'OPERATOR');
  if (!operator) throw new Error('Demo data needs an operator');

  for (const demo of data.incidents) {
    const reporter = accounts.get(demo.reporter);
    const type = types.find((t) => t.code === demo.type);
    if (!reporter || !type) throw new Error(`Unknown reporter or type in demo incident: ${demo.reporter} / ${demo.type}`);

    let incident = await service.create(reporter, {
      incidentTypeId: type.id,
      description: demo.description,
      latitude: demo.latitude,
      longitude: demo.longitude,
      locationText: demo.locationText,
    });

    if (demo.target === 'REJECTED') {
      incident = await service.reject(operator, incident.id, { reason: demo.rejectionReason ?? 'Not a traffic incident' });
    }

    const order = ['VERIFIED', 'ASSIGNED', 'RESPONDING', 'RESOLVED'];
    const reached = (status: string) => order.indexOf(demo.target) >= order.indexOf(status);

    if (reached('VERIFIED')) {
      incident = await service.verify(operator, incident.id, { severity: demo.severity ?? 'MEDIUM', note: null });
    }
    if (reached('ASSIGNED')) {
      const responderIds = demo.responders.map((unit) => {
        const id = unitToUserId.get(unit);
        if (!id) throw new Error(`Unknown responder unit ${unit}`);
        return id;
      });
      incident = await service.assign(operator, incident.id, { responderIds, notes: null });
    }
    if (reached('RESPONDING')) {
      for (const assignment of incident.assignments) {
        const responder = [...accounts.values()].find((a) => a.id === assignment.responder.id)!;
        incident = await service.respond(responder, assignment.id);
      }
    }
    if (reached('RESOLVED')) {
      const responder = [...accounts.values()].find((a) => a.id === incident.assignments[0]?.responder.id)!;
      incident = await service.resolve(responder, incident.id, { resolutionNotes: demo.resolutionNotes ?? 'Resolved.' });
    }

    console.log(`  Created incident ${incident.referenceNo} (${incident.status})`);
  }
}

async function main(): Promise<void> {
  loadEnvFile();
  const env = readSeedEnv();
  const demo = process.argv.includes('--demo');
  if (demo && !env.DEMO_USER_PASSWORD) {
    throw new ConfigError(['DEMO_USER_PASSWORD: required with --demo (the password for every demo account)']);
  }

  const pool = createPool(loadDatabaseConfig());
  const passwords = createPasswordHasher(env.BCRYPT_ROUNDS);

  try {
    console.log('Admin account:');
    const admin = await ensureUser(
      pool,
      passwords,
      { fullName: env.ADMIN_NAME, email: env.ADMIN_EMAIL, phone: null, role: 'ADMIN' },
      env.ADMIN_PASSWORD,
    );
    console.log(`  ${admin.created ? 'Created' : 'Exists '} ADMIN     ${env.ADMIN_EMAIL}`);

    if (demo) {
      console.log('Demo data:');
      await seedDemo(pool, passwords, env.DEMO_USER_PASSWORD!);
    }
    console.log('Seeding finished.');
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  if (error instanceof ConfigError) {
    console.error(error.message);
  } else {
    // PostgreSQL not running, tables missing, ... get a one-line explanation.
    console.error(explainDatabaseError(error, process.env.DATABASE_URL ?? '') ?? error);
  }
  process.exit(1);
});
