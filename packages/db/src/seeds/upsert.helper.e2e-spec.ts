import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { LLMProviderEnum, LLMStepEnum } from '@job-agent/shared';

import { parseDBEnv } from '../env/db-env.schema.js';
import type { IDatabaseConnection } from '../interfaces/database-connection.interface.js';
import { llmSettings } from '../schema/llm-settings.table.js';
import { openTestDatabase, truncateTables } from '../testing/test-database.helper.js';
import { insertMissingRows, upsertRows } from './upsert.helper.js';

/**
 * Natural key of `llm_settings`
 */
const target = [llmSettings.llm_setting_provider, llmSettings.llm_setting_step];

/**
 * A settings row of the resume step with the given model
 *
 * @param {string} model
 *
 * @returns {typeof llmSettings.$inferInsert}
 */
function resumeRow(model: string): typeof llmSettings.$inferInsert {
  return {
    llm_setting_provider: LLMProviderEnum.ANTHROPIC,
    llm_setting_step: LLMStepEnum.RESUME,
    llm_setting_model: model,
    llm_setting_params: { max_tokens: 100 }
  };
}

describe('upsert helpers (e2e)', () => {
  let connection: IDatabaseConnection;

  beforeAll(() => {
    connection = openTestDatabase(parseDBEnv(process.env).DATABASE_URL_TEST);
  });

  beforeEach(async () => {
    await truncateTables(connection.db, [llmSettings]);
  });

  afterAll(async () => {
    await connection.pool.end();
  });

  /**
   * The only settings row of the resume step
   *
   * @returns {Promise<typeof llmSettings.$inferSelect>}
   */
  async function readResumeRow(): Promise<typeof llmSettings.$inferSelect> {
    const rows = await connection.db.select().from(llmSettings).where(eq(llmSettings.llm_setting_step, LLMStepEnum.RESUME));

    expect(rows).toHaveLength(1);

    return rows[0] as typeof llmSettings.$inferSelect;
  }

  describe('upsertRows', () => {
    it('inserts a missing row without an update time', async () => {
      const written = await upsertRows({ db: connection.db, table: llmSettings, target, rows: [resumeRow('model-a')] });
      const row = await readResumeRow();

      expect(written).toBe(1);
      expect(row.llm_setting_model).toBe('model-a');
      expect(row.dt_update).toBeNull();
    });

    it('updates the non-key columns of an existing row, keeps its id and creation time, the trigger sets the update time', async () => {
      await upsertRows({ db: connection.db, table: llmSettings, target, rows: [resumeRow('model-a')] });
      const before = await readResumeRow();

      await upsertRows({
        db: connection.db,
        table: llmSettings,
        target,
        rows: [{ ...resumeRow('model-b'), llm_setting_params: { max_tokens: 200 } }]
      });
      const after = await readResumeRow();

      expect(after.llm_setting_id).toBe(before.llm_setting_id);
      expect(after.llm_setting_model).toBe('model-b');
      expect(after.llm_setting_params).toEqual({ max_tokens: 200 });
      expect(after.dt_create).toEqual(before.dt_create);
      expect(after.dt_update).toBeInstanceOf(Date);
    });

    it('writes nothing for an empty list', async () => {
      await expect(upsertRows({ db: connection.db, table: llmSettings, target, rows: [] })).resolves.toBe(0);
    });
  });

  describe('insertMissingRows', () => {
    it('inserts a missing row', async () => {
      await expect(insertMissingRows({ db: connection.db, table: llmSettings, target, rows: [resumeRow('model-a')] })).resolves.toBe(1);
    });

    it('never overwrites a row the owner tuned', async () => {
      await insertMissingRows({ db: connection.db, table: llmSettings, target, rows: [resumeRow('tuned-model')] });

      const written = await insertMissingRows({ db: connection.db, table: llmSettings, target, rows: [resumeRow('default-model')] });
      const row = await readResumeRow();

      expect(written).toBe(0);
      expect(row.llm_setting_model).toBe('tuned-model');
      expect(row.dt_update).toBeNull();
    });

    it('writes nothing for an empty list', async () => {
      await expect(insertMissingRows({ db: connection.db, table: llmSettings, target, rows: [] })).resolves.toBe(0);
    });
  });
});
