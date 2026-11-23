import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import { DT_UPDATE_FUNCTION, attachDtUpdateTrigger } from './dt-update.trigger.js';

describe('attachDtUpdateTrigger', () => {
  it('attaches the set_dt_update trigger with quoted names', () => {
    const { sql } = new PgDialect().sqlToQuery(attachDtUpdateTrigger('resumes'));

    expect(sql).toBe('CREATE TRIGGER "resumes_set_dt_update" BEFORE UPDATE ON "resumes" FOR EACH ROW EXECUTE FUNCTION "set_dt_update"()');
  });

  it('names the function of the first migration', () => {
    expect(DT_UPDATE_FUNCTION).toBe('set_dt_update');
  });
});
