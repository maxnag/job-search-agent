import { type SQL, getTableColumns, sql } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';

import type { IUpsertRequest } from '../interfaces/upsert-request.interface.js';

/**
 * Columns an upsert never overwrites: the creation time stays, the update time belongs to the trigger
 *
 * @type {ReadonlySet<string>}
 */
const PRESERVED_COLUMNS: ReadonlySet<string> = new Set(['dt_create', 'dt_update']);

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

/**
 * Insert only the rows whose natural key is missing (`INSERT … ON CONFLICT DO NOTHING`): for settings the owner
 * tunes by hand, where the seed gives defaults and must never overwrite a tuned row
 *
 * @param {IUpsertRequest<TTable>} request
 *
 * @template TTable
 *
 * @returns {Promise<number>} The number of rows inserted
 */
export async function insertMissingRows<TTable extends PgTable>(request: IUpsertRequest<TTable>): Promise<number> {
  if (request.rows.length === 0) {
    return 0;
  }

  const result = await request.db
    .insert(request.table)
    .values([...request.rows])
    .onConflictDoNothing({ target: [...request.target] });

  return result.rowCount ?? 0;
}
