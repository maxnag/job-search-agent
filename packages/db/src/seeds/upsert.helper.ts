import { type SQL, getTableColumns, sql } from 'drizzle-orm';
import type { PgColumn, PgInsertValue, PgTable } from 'drizzle-orm/pg-core';

import type { DatabaseExecutor } from '../client.js';

/**
 * Columns an upsert never overwrites: the creation time stays, the update time belongs to the trigger
 *
 * @type {ReadonlySet<string>}
 */
const PRESERVED_COLUMNS: ReadonlySet<string> = new Set(['dt_create', 'dt_update']);

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

/**
 * Insert rows, or update every non-key column of the rows that already exist
 * (`INSERT … ON CONFLICT DO UPDATE`), so a seed can run any number of times
 *
 * @param {IUpsertRequest<TTable>} request
 *
 * @template TTable
 *
 * @returns {Promise<number>} The number of rows written
 */
export async function upsertRows<TTable extends PgTable>(request: IUpsertRequest<TTable>): Promise<number> {
  if (request.rows.length === 0) {
    return 0;
  }

  const targetNames = new Set(request.target.map(column => column.name));
  const set: Record<string, SQL> = {};

  for (const [key, column] of Object.entries(getTableColumns(request.table))) {
    if (targetNames.has(column.name) || PRESERVED_COLUMNS.has(column.name)) {
      continue;
    }

    set[key] = sql`excluded.${sql.identifier(column.name)}`;
  }

  const result = await request.db
    .insert(request.table)
    .values([...request.rows])
    .onConflictDoUpdate({ target: [...request.target], set });

  return result.rowCount ?? 0;
}
