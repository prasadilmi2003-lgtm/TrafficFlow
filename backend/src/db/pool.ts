import pg from 'pg';
import type { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import type { DatabaseConfig } from '../config/env.js';

export type { Pool, PoolClient };

/**
 * Anything that can run a query: the pool itself, or a single client inside
 * a transaction. Repository functions accept this, so the same function
 * works both inside and outside a transaction.
 */
export interface Queryable {
  query<R extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<QueryResult<R>>;
}

/**
 * Creates the PostgreSQL connection pool. Connections are opened lazily on
 * the first query and reused afterwards.
 */
export function createPool(database: DatabaseConfig): Pool {
  return new pg.Pool({
    connectionString: database.url,
    max: database.poolMax,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
  });
}
