import { integer, jsonb, pgTable, text, unique } from 'drizzle-orm/pg-core';

import type { LLMProviderEnum, LLMStepEnum } from '@job-agent/shared';

import { timestampColumns } from '../columns/timestamp.columns.js';

/**
 * Model and parameters of every LLM step, per provider. The provider in use comes from `LLM_PROVIDER`;
 * `llm_setting_params` is the only source of the request parameters, under the provider's own names
 * (`max_tokens` for Anthropic, `num_predict` for Ollama), validated by the provider's schema on read
 */
export const llmSettings = pgTable(
  'llm_settings',
  {
    llm_setting_id: integer('llm_setting_id').primaryKey().generatedAlwaysAsIdentity(),
    llm_setting_provider: text('llm_setting_provider').$type<LLMProviderEnum>().notNull(),
    llm_setting_step: text('llm_setting_step').$type<LLMStepEnum>().notNull(),
    llm_setting_model: text('llm_setting_model').notNull(),
    llm_setting_params: jsonb('llm_setting_params').$type<Record<string, unknown>>().notNull().default({}),
    ...timestampColumns()
  },
  table => [unique('llm_settings_provider_step_uq').on(table.llm_setting_provider, table.llm_setting_step)]
);
