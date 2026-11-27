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
 * The one local model every Ollama step uses until the owner tunes a row
 *
 * @type {string}
 */
const OLLAMA_DEFAULT_MODEL = 'qwen3.8:27b-mlx';

/**
 * Context window of an Ollama step: the server default (4096) silently cuts a long listing page
 *
 * @type {number}
 */
const OLLAMA_CONTEXT_TOKENS = 16384;

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
 * Default LLM settings — a row per provider and step, thinking off. Rows the owner has tuned are kept
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
      rows: Object.values(LLMStepEnum).flatMap(step => [
        {
          llm_setting_provider: LLMProviderEnum.ANTHROPIC,
          llm_setting_step: step,
          llm_setting_model: ANTHROPIC_DEFAULT_MODEL,
          llm_setting_params: { max_tokens: MAX_TOKENS[step], thinking: 'disabled' }
        },
        {
          llm_setting_provider: LLMProviderEnum.OLLAMA,
          llm_setting_step: step,
          llm_setting_model: OLLAMA_DEFAULT_MODEL,
          llm_setting_params: { num_predict: MAX_TOKENS[step], num_ctx: OLLAMA_CONTEXT_TOKENS, think: false }
        }
      ])
    });
  }
};
