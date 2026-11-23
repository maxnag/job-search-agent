import type { Database } from '../interfaces/database-connection.interface.js';
import type { ISeedSet } from './seed-set.interface.js';

/**
 * Run seed sets one after another in a single transaction — all of them are written, or none
 *
 * @param {Database} db
 * @param {readonly ISeedSet[]} seeds
 *
 * @returns {Promise<void>}
 */
export async function runSeeds(db: Database, seeds: readonly ISeedSet[]): Promise<void> {
  await db.transaction(async tx => {
    for (const seed of seeds) {
      const rows = await seed.run(tx);

      console.info(`Seed ${seed.name}: ${rows} rows`);
    }
  });

  console.info(`Seeds done: ${seeds.length} sets`);
}
