import type { Queryable } from '../../db/pool.js';

/**
 * Statistics are calculated from the live tables with SQL aggregate
 * queries, so they can never drift out of sync with the data.
 */

export async function countIncidentsByStatus(db: Queryable): Promise<Array<{ key: string; count: number }>> {
  const { rows } = await db.query<{ key: string; count: number }>(
    'SELECT status AS key, count(*)::int AS count FROM incidents GROUP BY status',
  );
  return rows;
}

export async function countOpenIncidentsBySeverity(db: Queryable): Promise<Array<{ key: string; count: number }>> {
  const { rows } = await db.query<{ key: string; count: number }>(
    `SELECT severity AS key, count(*)::int AS count FROM incidents
     WHERE status IN ('VERIFIED', 'ASSIGNED', 'RESPONDING') AND severity IS NOT NULL
     GROUP BY severity`,
  );
  return rows;
}

export async function countIncidentsByTypeLast30Days(
  db: Queryable,
): Promise<Array<{ code: string; name: string; count: number }>> {
  const { rows } = await db.query<{ code: string; name: string; count: number }>(
    `SELECT t.code, t.name, count(i.id)::int AS count
     FROM incident_types t
     LEFT JOIN incidents i ON i.incident_type_id = t.id AND i.created_at >= now() - interval '30 days'
     WHERE t.is_active OR i.id IS NOT NULL
     GROUP BY t.id, t.code, t.name
     ORDER BY count DESC, t.name`,
  );
  return rows;
}

export interface ActivitySummary {
  reportedLast24h: number;
  resolvedLast24h: number;
  /** Average minutes from report to resolution over the last 30 days (null if none resolved) */
  averageResolutionMinutes: number | null;
}

export async function activitySummary(db: Queryable): Promise<ActivitySummary> {
  const { rows } = await db.query<ActivitySummary>(
    `SELECT
       count(*) FILTER (WHERE created_at >= now() - interval '24 hours')::int AS "reportedLast24h",
       count(*) FILTER (WHERE resolved_at >= now() - interval '24 hours')::int AS "resolvedLast24h",
       round(avg(extract(epoch FROM resolved_at - created_at) / 60)
             FILTER (WHERE status = 'RESOLVED' AND resolved_at >= now() - interval '30 days'))::int
         AS "averageResolutionMinutes"
     FROM incidents`,
  );
  return rows[0]!;
}

/** Reported and resolved incidents per day for the last 7 days (including today). */
export async function dailyActivity(db: Queryable): Promise<Array<{ date: string; reported: number; resolved: number }>> {
  const { rows } = await db.query<{ date: string; reported: number; resolved: number }>(
    `SELECT to_char(day, 'YYYY-MM-DD') AS date,
            (SELECT count(*)::int FROM incidents
              WHERE created_at >= day AND created_at < day + interval '1 day') AS reported,
            (SELECT count(*)::int FROM incidents
              WHERE resolved_at >= day AND resolved_at < day + interval '1 day') AS resolved
     FROM generate_series(date_trunc('day', now()) - interval '6 days', date_trunc('day', now()), interval '1 day') AS day
     ORDER BY day`,
  );
  return rows;
}

export async function countRespondersByAvailability(db: Queryable): Promise<Array<{ key: string; count: number }>> {
  const { rows } = await db.query<{ key: string; count: number }>(
    `SELECT rp.availability AS key, count(*)::int AS count
     FROM responder_profiles rp
     JOIN users u ON u.id = rp.user_id
     WHERE u.is_active
     GROUP BY rp.availability`,
  );
  return rows;
}

export async function countUsersByRole(db: Queryable): Promise<Array<{ key: string; count: number; active: number }>> {
  const { rows } = await db.query<{ key: string; count: number; active: number }>(
    `SELECT role AS key, count(*)::int AS count, count(*) FILTER (WHERE is_active)::int AS active
     FROM users GROUP BY role`,
  );
  return rows;
}

export async function systemTotals(db: Queryable): Promise<{
  incidentsTotal: number;
  incidentsLast30Days: number;
  assignmentsTotal: number;
  assignmentsActive: number;
  incidentTypesActive: number;
  incidentTypesInactive: number;
}> {
  const { rows } = await db.query<{
    incidentsTotal: number;
    incidentsLast30Days: number;
    assignmentsTotal: number;
    assignmentsActive: number;
    incidentTypesActive: number;
    incidentTypesInactive: number;
  }>(
    `SELECT
       (SELECT count(*)::int FROM incidents) AS "incidentsTotal",
       (SELECT count(*)::int FROM incidents WHERE created_at >= now() - interval '30 days') AS "incidentsLast30Days",
       (SELECT count(*)::int FROM incident_assignments) AS "assignmentsTotal",
       (SELECT count(*)::int FROM incident_assignments WHERE status IN ('ASSIGNED', 'RESPONDING')) AS "assignmentsActive",
       (SELECT count(*)::int FROM incident_types WHERE is_active) AS "incidentTypesActive",
       (SELECT count(*)::int FROM incident_types WHERE NOT is_active) AS "incidentTypesInactive"`,
  );
  return rows[0]!;
}
