import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import type { IDatabaseConnection, IDatabaseConnectionOptions } from './interfaces/database-connection.interface.js';
import * as schema from './schema/index.js';

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
