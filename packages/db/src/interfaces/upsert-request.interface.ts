import type { PgColumn, PgInsertValue, PgTable } from 'drizzle-orm/pg-core';

import type { DatabaseExecutor } from './database-connection.interface.js';

/**
 * Rows to insert or update by their natural key
 *
 * @template TTable
 */
export interface IUpsertRequest<TTable extends PgTable> {
  /**
   * Database or transaction to write to
   *
   * @var {DatabaseExecutor}
   */
  readonly db: DatabaseExecutor;

  /**
   * Table to write to
   *
   * @var {TTable}
   */
  readonly table: TTable;

  /**
   * Rows to write
   *
   * @var {readonly PgInsertValue<TTable>[]}
   */
  readonly rows: readonly PgInsertValue<TTable>[];

  /**
   * Natural key — the columns of a unique index the conflict is detected on
   *
   * @var {readonly PgColumn[]}
   */
  readonly target: readonly PgColumn[];
}
