import type { ISeedSet } from '../seed-set.interface.js';
import { llmSettingsSeed } from './llm-settings.seed.js';

/**
 * Reference data — run on every environment by `pnpm db:seed`
 *
 * @type {readonly ISeedSet[]}
 */
export const REFERENCE_SEEDS: readonly ISeedSet[] = [llmSettingsSeed];
