import type { Pool } from '../../db/pool.js';
import {
  AVAILABILITIES,
  INCIDENT_STATUSES,
  OPEN_INCIDENT_STATUSES,
  ROLES,
  SEVERITIES,
} from '../../types/domain.js';
import * as repository from './stats.repository.js';

/** Turns [{ key, count }] rows into { KEY: count } with a 0 for every missing key. */
function countsByKey<K extends string>(keys: readonly K[], rows: Array<{ key: string; count: number }>): Record<K, number> {
  const result = Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;
  for (const row of rows) {
    if (row.key in result) result[row.key as K] = row.count;
  }
  return result;
}

export function createStatsService({ pool, appVersion }: { pool: Pool; appVersion: string }) {
  return {
    /** Operator dashboard: what's happening right now. */
    async dashboard() {
      const [byStatus, bySeverity, byType, activity, daily, responders] = await Promise.all([
        repository.countIncidentsByStatus(pool),
        repository.countOpenIncidentsBySeverity(pool),
        repository.countIncidentsByTypeLast30Days(pool),
        repository.activitySummary(pool),
        repository.dailyActivity(pool),
        repository.countRespondersByAvailability(pool),
      ]);

      const statusCounts = countsByKey(INCIDENT_STATUSES, byStatus);

      return {
        openIncidents: OPEN_INCIDENT_STATUSES.reduce((sum, status) => sum + statusCounts[status], 0),
        ...activity,
        incidentsByStatus: statusCounts,
        openIncidentsBySeverity: countsByKey(SEVERITIES, bySeverity),
        incidentsByTypeLast30Days: byType,
        last7Days: daily,
        respondersByAvailability: countsByKey(AVAILABILITIES, responders),
      };
    },

    /** Admin overview of the whole system. */
    async system() {
      const [usersByRole, totals, byStatus] = await Promise.all([
        repository.countUsersByRole(pool),
        repository.systemTotals(pool),
        repository.countIncidentsByStatus(pool),
      ]);

      const roleCounts = countsByKey(ROLES, usersByRole);
      const activeUsers = usersByRole.reduce((sum, row) => sum + row.active, 0);
      const totalUsers = usersByRole.reduce((sum, row) => sum + row.count, 0);

      return {
        users: { total: totalUsers, active: activeUsers, inactive: totalUsers - activeUsers, byRole: roleCounts },
        incidents: {
          total: totals.incidentsTotal,
          last30Days: totals.incidentsLast30Days,
          byStatus: countsByKey(INCIDENT_STATUSES, byStatus),
        },
        assignments: { total: totals.assignmentsTotal, active: totals.assignmentsActive },
        incidentTypes: { active: totals.incidentTypesActive, inactive: totals.incidentTypesInactive },
        service: {
          version: appVersion,
          nodeVersion: process.version,
          uptimeSeconds: Math.floor(process.uptime()),
        },
      };
    },
  };
}

export type StatsService = ReturnType<typeof createStatsService>;
