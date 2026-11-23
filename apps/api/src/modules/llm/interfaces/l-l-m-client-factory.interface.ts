import type { ConfigService } from '@nestjs/config';

import type { IEnv } from '../../../config/env.schema.js';
import type { LLMClient } from '../clients/l-l-m.client.js';
import type { LLMSettingsService } from '../services/l-l-m-settings.service.js';

/**
 * Builds the adapter of one LLM provider from the configuration
 */
export type LLMClientFactoryType = (configService: ConfigService<IEnv, true>, llmSettingsService: LLMSettingsService) => LLMClient;
