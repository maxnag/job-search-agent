import type { ConfigService } from '@nestjs/config';

import { LLMProviderEnum } from '@job-agent/shared';

import { type IEnv, LLM_PROVIDER_REQUIRED_KEYS } from '../../../config/env.schema.js';
import type { LLMClientFactoryType } from '../interfaces/l-l-m-client-factory.interface.js';
import { AnthropicLLMClient } from './anthropic-l-l-m.client.js';
import { OllamaLLMClient } from './ollama-l-l-m.client.js';

/**
 * Value of the key a provider cannot start without; the env schema has already checked it, this narrows the type
 *
 * @param {ConfigService<IEnv, true>} configService
 * @param {LLMProviderEnum} provider
 *
 * @throws {Error} `LLM_PROVIDER_MISCONFIGURED` if the key is missing
 *
 * @returns {string}
 */
function requiredSetting(configService: ConfigService<IEnv, true>, provider: LLMProviderEnum): string {
  const key = LLM_PROVIDER_REQUIRED_KEYS[provider];
  const value = configService.get(key, { infer: true });

  if (!value) {
    throw new Error(`LLM_PROVIDER_MISCONFIGURED: ${key} is required when LLM_PROVIDER=${provider}`);
  }

  return value;
}

/**
 * Adapter factory of every provider. A `Record` over the enum: a provider added to `LLMProviderEnum` without a
 * factory here does not compile — there is no silent fallback to another provider
 *
 * @type {Readonly<Record<LLMProviderEnum, LLMClientFactoryType>>}
 */
export const LLM_CLIENT_FACTORIES: Readonly<Record<LLMProviderEnum, LLMClientFactoryType>> = {
  [LLMProviderEnum.ANTHROPIC]: (configService, llmSettingsService) =>
    new AnthropicLLMClient(
      {
        apiKey: requiredSetting(configService, LLMProviderEnum.ANTHROPIC),
        timeoutMs: configService.get('LLM_TIMEOUT_MS', { infer: true })
      },
      llmSettingsService
    ),
  [LLMProviderEnum.OLLAMA]: (configService, llmSettingsService) =>
    new OllamaLLMClient(
      {
        url: requiredSetting(configService, LLMProviderEnum.OLLAMA),
        timeoutMs: configService.get('LLM_TIMEOUT_MS', { infer: true })
      },
      llmSettingsService
    )
};
