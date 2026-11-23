import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LLMProviderEnum, LLMStepEnum } from '@job-agent/shared';

import type { DatabaseExecutor } from '../../interfaces/database-connection.interface.js';
import { llmSettings } from '../../schema/llm-settings.table.js';
import { llmSettingsSeed } from './llm-settings.seed.js';

const insertMissingRows = vi.hoisted(() => vi.fn(() => Promise.resolve(4)));

vi.mock('../upsert.helper.js', () => ({ insertMissingRows }));

describe('llmSettingsSeed', () => {
  beforeEach(() => {
    insertMissingRows.mockClear();
  });

  it('inserts only the missing rows, keyed by provider and step', async () => {
    const db = {} as DatabaseExecutor;

    await expect(llmSettingsSeed.run(db)).resolves.toBe(4);
    expect(insertMissingRows).toHaveBeenCalledWith(
      expect.objectContaining({ db, table: llmSettings, target: [llmSettings.llm_setting_provider, llmSettings.llm_setting_step] })
    );
  });

  it('gives every step an Anthropic row with max_tokens and thinking off', async () => {
    await llmSettingsSeed.run({} as DatabaseExecutor);

    const [[{ rows }]] = insertMissingRows.mock.calls as unknown as [[{ rows: Record<string, unknown>[] }]];

    const byName = (first: string, second: string): number => first.localeCompare(second);

    expect(rows.map(row => String(row.llm_setting_step)).sort(byName)).toEqual(Object.values(LLMStepEnum).sort(byName));
    expect(rows.every(row => row.llm_setting_provider === LLMProviderEnum.ANTHROPIC)).toBe(true);
    expect(rows.find(row => row.llm_setting_step === LLMStepEnum.RESUME)?.llm_setting_params).toEqual({
      max_tokens: 8192,
      thinking: 'disabled'
    });
  });
});
