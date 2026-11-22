import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { IEnv } from '../../config/env.schema.js';
import { AnthropicLLMClient } from './clients/anthropic-l-l-m.client.js';
import { LLMClient } from './clients/l-l-m.client.js';
import { OllamaLLMClient } from './clients/ollama-l-l-m.client.js';
import { LLMProviderEnum } from './enums/l-l-m-provider.enum.js';
import { LLMModelService } from './services/l-l-m-model.service.js';

/**
 * Build the adapter of the provider chosen by `LLM_PROVIDER`; the schema has already checked its keys
 *
 * @param {ConfigService<IEnv, true>} configService
 * @param {LLMModelService} llmModelService
 *
 * @throws {Error} `LLM_PROVIDER_MISCONFIGURED` if a key of the chosen provider is missing
 *
 * @returns {LLMClient}
 */
function createLLMClient(configService: ConfigService<IEnv, true>, llmModelService: LLMModelService): LLMClient {
  const timeoutMs = configService.get('LLM_TIMEOUT_MS', { infer: true });

  if (configService.get('LLM_PROVIDER', { infer: true }) === LLMProviderEnum.OLLAMA) {
    const url = configService.get('OLLAMA_URL', { infer: true });

    if (!url) {
      throw new Error('LLM_PROVIDER_MISCONFIGURED: OLLAMA_URL is required when LLM_PROVIDER=ollama');
    }

    return new OllamaLLMClient({ url, timeoutMs }, llmModelService);
  }

  const apiKey = configService.get('ANTHROPIC_API_KEY', { infer: true });

  if (!apiKey) {
    throw new Error('LLM_PROVIDER_MISCONFIGURED: ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic');
  }

  return new AnthropicLLMClient({ apiKey, timeoutMs }, llmModelService);
}

/**
 * The LLM port bound to the configured provider
 */
@Module({
  providers: [
    LLMModelService,
    {
      provide: LLMClient,
      inject: [ConfigService, LLMModelService],
      useFactory: createLLMClient
    }
  ],
  exports: [LLMClient, LLMModelService]
})
export class LLMModule {}
