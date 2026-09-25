import type { Queryable } from '../../db/pool.js';

export interface IncidentType {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const COLUMNS = `
  id, code, name, description,
  is_active AS "isActive",
  created_at AS "createdAt",
  updated_at AS "updatedAt"`;

export async function list(db: Queryable, { activeOnly }: { activeOnly: boolean }): Promise<IncidentType[]> {
  const { rows } = await db.query<IncidentType>(
    `SELECT ${COLUMNS} FROM incident_types
     ${activeOnly ? 'WHERE is_active' : ''}
     ORDER BY (code = 'OTHER'), name`,
  );
  return rows;
}

export async function findById(db: Queryable, id: string): Promise<IncidentType | null> {
  const { rows } = await db.query<IncidentType>(`SELECT ${COLUMNS} FROM incident_types WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function insert(
  db: Queryable,
  type: { code: string; name: string; description: string | null },
): Promise<IncidentType> {
  const { rows } = await db.query<IncidentType>(
    `INSERT INTO incident_types (code, name, description) VALUES ($1, $2, $3) RETURNING ${COLUMNS}`,
    [type.code, type.name, type.description],
  );
  return rows[0]!;
}

export async function update(
  db: Queryable,
  id: string,
  changes: { name?: string; description?: string | null; isActive?: boolean },
): Promise<IncidentType | null> {
  // COALESCE keeps the current value for fields that were not sent.
  const { rows } = await db.query<IncidentType>(
    `UPDATE incident_types SET
       name = COALESCE($2, name),
       description = CASE WHEN $3::boolean THEN $4 ELSE description END,
       is_active = COALESCE($5, is_active)
     WHERE id = $1
     RETURNING ${COLUMNS}`,
    [id, changes.name ?? null, changes.description !== undefined, changes.description ?? null, changes.isActive ?? null],
  );
  return rows[0] ?? null;
}
