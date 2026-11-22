import { type NodePgDatabase, type NodePgQueryResultHKT, drizzle } from 'drizzle-orm/node-postgres';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { Pool } from 'pg';

import * as schema from './schema/index.js';

/**
 * Drizzle database bound to the project schema
 */
export type Database = NodePgDatabase<typeof schema>;

/**
 * Anything that runs queries against the project schema: the database or a transaction
 */
export type DatabaseExecutor = PgDatabase<NodePgQueryResultHKT, typeof schema>;

/**
 * Options of a database connection
 */
export interface IDatabaseConnectionOptions {
  /**
   * Postgres connection string
   *
   * @var {string}
   */
  readonly url: string;

  /**
   * How long to wait for a connection from the pool
   *
   * @var {number}
   */
  readonly connectionTimeoutMs: number;
}

/**
 * An open database: the Drizzle client and the pool behind it
 */
export interface IDatabaseConnection {
  /**
   * Drizzle client
   *
   * @var {Database}
   */
  readonly db: Database;

  /**
   * Pool of `pg` connections, closed with `pool.end()`
   *
   * @var {Pool}
   */
  readonly pool: Pool;
}

/**
 * Open a pool of Postgres connections and bind Drizzle to it
 *
 * @param {IDatabaseConnectionOptions} options
 *
 * @returns {IDatabaseConnection}
 */
export function createDatabaseConnection(options: IDatabaseConnectionOptions): IDatabaseConnection {
  const pool = new Pool({
    connectionString: options.url,
    connectionTimeoutMillis: options.connectionTimeoutMs
  });

  return { db: drizzle({ client: pool, schema }), pool };
}
