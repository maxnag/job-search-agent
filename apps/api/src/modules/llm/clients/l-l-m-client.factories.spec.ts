import { createMock } from '@golevelup/ts-vitest';
import { describe, expect, it } from 'vitest';

import { LLMProviderEnum } from '@job-agent/shared';

import { createConfigMock } from '../../../../test/config-service.mock.js';
import { LLMSettingsService } from '../services/l-l-m-settings.service.js';
import { AnthropicLLMClient } from './anthropic-l-l-m.client.js';
import { LLM_CLIENT_FACTORIES } from './l-l-m-client.factories.js';
import { OllamaLLMClient } from './ollama-l-l-m.client.js';

const settings = createMock<LLMSettingsService>();

describe('LLM_CLIENT_FACTORIES', () => {
  it('has a factory for every provider', () => {
    const byName = (first: string, second: string): number => first.localeCompare(second);

    expect(Object.keys(LLM_CLIENT_FACTORIES).sort(byName)).toEqual(Object.values(LLMProviderEnum).sort(byName));
  });

  it('builds the Anthropic adapter from its key', () => {
    const config = createConfigMock({ ANTHROPIC_API_KEY: 'test-key-never-sent', LLM_TIMEOUT_MS: 1000 });

    expect(LLM_CLIENT_FACTORIES[LLMProviderEnum.ANTHROPIC](config, settings)).toBeInstanceOf(AnthropicLLMClient);
  });

  it('builds the Ollama adapter from its URL', () => {
    const config = createConfigMock({ OLLAMA_URL: 'http://localhost:11434', LLM_TIMEOUT_MS: 1000 });

    expect(LLM_CLIENT_FACTORIES[LLMProviderEnum.OLLAMA](config, settings)).toBeInstanceOf(OllamaLLMClient);
  });

  it('names the key a provider cannot start without', () => {
    const config = createConfigMock({ LLM_TIMEOUT_MS: 1000 });

    expect(() => LLM_CLIENT_FACTORIES[LLMProviderEnum.OLLAMA](config, settings)).toThrow(
      'LLM_PROVIDER_MISCONFIGURED: OLLAMA_URL is required when LLM_PROVIDER=ollama'
    );
  });
});
