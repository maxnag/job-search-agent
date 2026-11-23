import { LLMProviderEnum, LLMStepEnum } from '@job-agent/shared';

import type { DatabaseExecutor } from '../../interfaces/database-connection.interface.js';
import { llmSettings } from '../../schema/llm-settings.table.js';
import type { ISeedSet } from '../seed-set.interface.js';
import { insertMissingRows } from '../upsert.helper.js';

/**
 * Anthropic model used by every step until the owner tunes a row
 *
 * @type {string}
 */
const ANTHROPIC_DEFAULT_MODEL = 'claude-haiku-5-5';

/**
 * Output budget of each step: a resume and a listing page yield the largest structures, an e-mail the smallest
 *
 * @type {Readonly<Record<LLMStepEnum, number>>}
 */
const MAX_TOKENS: Readonly<Record<LLMStepEnum, number>> = {
  [LLMStepEnum.RESUME]: 8192,
  [LLMStepEnum.LISTING]: 8192,
  [LLMStepEnum.EXTRACT]: 4096,
  [LLMStepEnum.MAIL]: 2048,
  [LLMStepEnum.NAVIGATION]: 4096
};

/**
 * Default LLM settings — Anthropic only; extraction needs no thinking. Rows the owner has tuned are kept
 *
 * @type {ISeedSet}
 */
export const llmSettingsSeed: ISeedSet = {
  name: 'llm-settings',

  /**
   * Insert the missing rows
   *
   * @param {DatabaseExecutor} db
   *
   * @returns {Promise<number>}
   */
  async run(db: DatabaseExecutor): Promise<number> {
    return insertMissingRows({
      db,
      table: llmSettings,
      target: [llmSettings.llm_setting_provider, llmSettings.llm_setting_step],
      rows: Object.values(LLMStepEnum).map(step => ({
        llm_setting_provider: LLMProviderEnum.ANTHROPIC,
        llm_setting_step: step,
        llm_setting_model: ANTHROPIC_DEFAULT_MODEL,
        llm_setting_params: { max_tokens: MAX_TOKENS[step], thinking: 'disabled' }
      }))
    });
  }
};
