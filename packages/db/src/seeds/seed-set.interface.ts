import type { DatabaseExecutor } from '../interfaces/database-connection.interface.js';

/**
 * One named set of seed rows
 */
export interface ISeedSet {
  /**
   * Name shown in the seed log
   *
   * @var {string}
   */
  readonly name: string;

  /**
   * Write the rows of the set; must be idempotent
   *
   * @param {DatabaseExecutor} db
   *
   * @returns {Promise<number>} The number of rows written
   */
  run(db: DatabaseExecutor): Promise<number>;
}
