import { createDatabaseConnection } from '../client.js';
import type { IDBEnv } from '../env/db-env.schema.js';
import { runSeeds } from './seed-runner.js';
import type { ISeedSet } from './seed-set.interface.js';

/**
 * Open the database, run the seed sets and close the pool, also on failure
 *
 * @param {IDBEnv} env
 * @param {readonly ISeedSet[]} seeds
 *
 * @returns {Promise<void>}
 */
export async function runSeedScript(env: IDBEnv, seeds: readonly ISeedSet[]): Promise<void> {
  const { db, pool } = createDatabaseConnection({
    url: env.DATABASE_URL,
    connectionTimeoutMs: env.DATABASE_CONNECTION_TIMEOUT_MS
  });

  try {
    await runSeeds(db, seeds);
  } finally {
    await pool.end();
  }
}
