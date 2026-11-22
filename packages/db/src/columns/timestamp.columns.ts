import { timestamp } from 'drizzle-orm/pg-core';

/**
 * The `dt_create` and `dt_update` columns every table has.
 * `dt_update` is set by the `set_dt_update()` trigger, never by the application
 *
 * @returns {{ dt_create: ReturnType<typeof timestamp>, dt_update: ReturnType<typeof timestamp> }}
 */
export function timestampColumns() {
  return {
    dt_create: timestamp('dt_create', { withTimezone: true }).notNull().defaultNow(),
    dt_update: timestamp('dt_update', { withTimezone: true })
  };
}
