import type { NodePgDatabase, NodePgQueryResultHKT } from 'drizzle-orm/node-postgres';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import type { Pool } from 'pg';

import type * as schema from '../schema/index.js';

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
