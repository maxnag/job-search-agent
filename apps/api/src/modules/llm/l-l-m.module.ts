import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { IEnv } from '../../config/env.schema.js';
import { LLM_CLIENT_FACTORIES } from './clients/l-l-m-client.factories.js';
import { LLMClient } from './clients/l-l-m.client.js';
import { LLMSettingsRepository } from './repositories/l-l-m-settings.repository.js';
import { LLMSettingsService } from './services/l-l-m-settings.service.js';

/**
 * The LLM port bound to the adapter of `LLM_PROVIDER`, built by its factory in `LLM_CLIENT_FACTORIES`
 */
@Module({
  providers: [
    LLMSettingsRepository,
    LLMSettingsService,
    {
      provide: LLMClient,
      inject: [ConfigService, LLMSettingsService],
      useFactory: (configService: ConfigService<IEnv, true>, llmSettingsService: LLMSettingsService) =>
        LLM_CLIENT_FACTORIES[configService.get('LLM_PROVIDER', { infer: true })](configService, llmSettingsService)
    }
  ],
  exports: [LLMClient, LLMSettingsService]
})
export class LLMModule {}
