import { type DeepMocked, createMock } from '@golevelup/ts-vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { LLMProviderEnum, LLMStepEnum } from '@job-agent/shared';

import { LLMSettingsService } from '../services/l-l-m-settings.service.js';
import { OllamaLLMClient } from './ollama-l-l-m.client.js';

const ollama = vi.hoisted(() => ({ chat: vi.fn(), list: vi.fn() }));

vi.mock('ollama', () => ({
  Ollama: class {
    chat = ollama.chat;
    list = ollama.list;
  }
}));

const schema = z.object({ title: z.string() });

describe('OllamaLLMClient (unit)', () => {
  let settings: DeepMocked<LLMSettingsService>;
  let subjectUnderTest: OllamaLLMClient;

  beforeEach(() => {
    vi.clearAllMocks();
    settings = createMock<LLMSettingsService>();
    subjectUnderTest = new OllamaLLMClient({ url: 'http://localhost:11434', timeoutMs: 5000 }, settings);
  });

  it('should be defined', () => {
    expect(subjectUnderTest).toBeDefined();
  });

  describe('generateBySchema', () => {
    it('sends the schema as format, the params as options, and validates the answer', async () => {
      settings.findOne.mockResolvedValue({ step: LLMStepEnum.MAIL, model: 'qwen3:9b', params: { num_predict: 512, temperature: 0 } });
      ollama.chat.mockResolvedValue({ message: { content: '{"title":"Developer"}' } });

      await expect(
        subjectUnderTest.generateBySchema({ step: LLMStepEnum.MAIL, system: 'classify', prompt: 'mail', schema })
      ).resolves.toEqual({
        data: { title: 'Developer' },
        model: 'qwen3:9b'
      });
      expect(ollama.chat).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'qwen3:9b',
          options: { num_predict: 512, temperature: 0 },
          stream: false,
          messages: [
            { role: 'system', content: 'classify' },
            { role: 'user', content: 'mail' }
          ]
        })
      );
    });

    it('sends no system message without system instructions', async () => {
      settings.findOne.mockResolvedValue({ step: LLMStepEnum.MAIL, model: 'qwen3:9b', params: {} });
      ollama.chat.mockResolvedValue({ message: { content: '{"title":"Developer"}' } });

      await subjectUnderTest.generateBySchema({ step: LLMStepEnum.MAIL, prompt: 'mail', schema });

      expect(ollama.chat).toHaveBeenCalledWith(expect.objectContaining({ messages: [{ role: 'user', content: 'mail' }] }));
    });
  });

  describe('checkHealth', () => {
    it('accepts a model pulled with the latest tag', async () => {
      settings.findAll.mockResolvedValue({ models: ['qwen3:9b', 'llama3'], missingSteps: [] });
      ollama.list.mockResolvedValue({ models: [{ name: 'qwen3:9b' }, { name: 'llama3:latest' }] });

      await expect(subjectUnderTest.checkHealth(3000)).resolves.toEqual({
        provider: LLMProviderEnum.OLLAMA,
        up: true,
        missingModels: [],
        missingSettings: []
      });
    });

    it('is down with the models not pulled', async () => {
      settings.findAll.mockResolvedValue({ models: ['qwen3:27b'], missingSteps: [] });
      ollama.list.mockResolvedValue({ models: [] });

      await expect(subjectUnderTest.checkHealth(3000)).resolves.toMatchObject({ up: false, missingModels: ['qwen3:27b'] });
    });

    it('is down with every model when Ollama does not answer', async () => {
      settings.findAll.mockResolvedValue({ models: ['qwen3:9b'], missingSteps: [] });
      ollama.list.mockRejectedValue(new Error('fetch failed'));

      await expect(subjectUnderTest.checkHealth(3000)).resolves.toMatchObject({
        up: false,
        missingModels: ['qwen3:9b'],
        reason: 'fetch failed'
      });
    });
  });
});
