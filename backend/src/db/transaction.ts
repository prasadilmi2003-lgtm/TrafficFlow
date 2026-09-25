import type { Pool, PoolClient } from './pool.js';

/**
 * Runs `work` inside a database transaction: either every statement
 * succeeds (COMMIT) or none of them take effect (ROLLBACK).
 *
 * Example: changing an incident's status and writing its history entry
 * must happen together, so both run inside one transaction.
 */
export async function withTransaction<T>(pool: Pool, work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
