import type { InferSelectModel } from 'drizzle-orm';

import type { llmSettings } from '@job-agent/db';

/**
 * A row of `llm_settings`
 */
export type LLMSettingRowType = InferSelectModel<typeof llmSettings>;
