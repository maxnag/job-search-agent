import { type SQL, sql } from 'drizzle-orm';

/**
 * Name of the trigger function created by the first migration
 *
 * @type {string}
 */
export const DT_UPDATE_FUNCTION = 'set_dt_update';

/**
 * Statement that attaches the `set_dt_update()` trigger to a table
 *
 * @param {string} tableName
 *
 * @returns {SQL}
 */
export function attachDtUpdateTrigger(tableName: string): SQL {
  const triggerName = `${tableName}_${DT_UPDATE_FUNCTION}`;

  return sql`CREATE TRIGGER ${sql.identifier(triggerName)} BEFORE UPDATE ON ${sql.identifier(tableName)} FOR EACH ROW EXECUTE FUNCTION ${sql.identifier(DT_UPDATE_FUNCTION)}()`;
}
