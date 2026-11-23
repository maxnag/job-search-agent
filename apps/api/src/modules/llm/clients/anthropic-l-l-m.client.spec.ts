import { type DeepMocked, createMock } from '@golevelup/ts-vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { LLMProviderEnum, LLMStepEnum } from '@job-agent/shared';

import { LLMSettingsService } from '../services/l-l-m-settings.service.js';
import { AnthropicLLMClient } from './anthropic-l-l-m.client.js';

const sdk = vi.hoisted(() => ({ create: vi.fn(), retrieve: vi.fn(), options: vi.fn() }));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: sdk.create };
    models = { retrieve: sdk.retrieve };

    constructor(options: unknown) {
      sdk.options(options);
    }
  }
}));

const schema = z.object({ title: z.string() });
const answer = (text: string, stopReason = 'end_turn') => ({
  content: [{ type: 'text', text }],
  stop_reason: stopReason,
  usage: { input_tokens: 10, output_tokens: 5 }
});

describe('AnthropicLLMClient (unit)', () => {
  let settings: DeepMocked<LLMSettingsService>;
  let subjectUnderTest: AnthropicLLMClient;

  beforeEach(() => {
    vi.clearAllMocks();
    settings = createMock<LLMSettingsService>();
    subjectUnderTest = new AnthropicLLMClient({ apiKey: 'test-key-never-sent', timeoutMs: 5000 }, settings);
  });

  it('should be defined', () => {
    expect(subjectUnderTest).toBeDefined();
    expect(sdk.options).toHaveBeenCalledWith({ apiKey: 'test-key-never-sent', timeout: 5000 });
  });

  describe('generateBySchema', () => {
    it('sends the step settings and returns the validated answer with the model', async () => {
      settings.findOne.mockResolvedValue({
        step: LLMStepEnum.RESUME,
        model: 'claude-haiku-5-5',
        params: { max_tokens: 2048, thinking: 'disabled' }
      });
      sdk.create.mockResolvedValue(answer('{"title":"Developer"}'));

      await expect(
        subjectUnderTest.generateBySchema({ step: LLMStepEnum.RESUME, system: 'extract', prompt: 'resume', schema })
      ).resolves.toEqual({
        data: { title: 'Developer' },
        model: 'claude-haiku-5-5'
      });
      expect(sdk.create).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'claude-haiku-5-5', max_tokens: 2048, thinking: { type: 'disabled' }, system: 'extract' })
      );
    });

    it('passes the effort of adaptive thinking', async () => {
      settings.findOne.mockResolvedValue({
        step: LLMStepEnum.EXTRACT,
        model: 'claude-haiku-5-5',
        params: { max_tokens: 2048, thinking: 'adaptive', effort: 'low' }
      });
      sdk.create.mockResolvedValue(answer('{"title":"Developer"}'));

      await subjectUnderTest.generateBySchema({ step: LLMStepEnum.EXTRACT, prompt: 'vacancy', schema });

      expect(sdk.create).toHaveBeenCalledWith(
        expect.objectContaining({ thinking: { type: 'adaptive' }, output_config: expect.objectContaining({ effort: 'low' }) as unknown })
      );
    });

    it('refuses an answer cut by max_tokens instead of parsing it', async () => {
      settings.findOne.mockResolvedValue({ step: LLMStepEnum.RESUME, model: 'm', params: { max_tokens: 50, thinking: 'disabled' } });
      sdk.create.mockResolvedValue(answer('{"title":"Dev', 'max_tokens'));

      await expect(subjectUnderTest.generateBySchema({ step: LLMStepEnum.RESUME, prompt: 'resume', schema })).rejects.toThrow(
        'LLM_OUTPUT_TRUNCATED: resume answer reached max_tokens 50'
      );
    });

    it('refuses an answer of another shape', async () => {
      settings.findOne.mockResolvedValue({ step: LLMStepEnum.RESUME, model: 'm', params: { max_tokens: 50, thinking: 'disabled' } });
      sdk.create.mockResolvedValue(answer('{"name":"Developer"}'));

      await expect(subjectUnderTest.generateBySchema({ step: LLMStepEnum.RESUME, prompt: 'resume', schema })).rejects.toThrow(
        'LLM_OUTPUT_SCHEMA_INVALID'
      );
    });
  });

  describe('checkHealth', () => {
    it('is up when every model exists and every step has settings', async () => {
      settings.findAll.mockResolvedValue({ models: ['claude-haiku-5-5'], missingSteps: [] });
      sdk.retrieve.mockResolvedValue({ id: 'claude-haiku-5-5' });

      await expect(subjectUnderTest.checkHealth(3000)).resolves.toEqual({
        provider: LLMProviderEnum.ANTHROPIC,
        up: true,
        missingModels: [],
        missingSettings: []
      });
      expect(sdk.retrieve).toHaveBeenCalledWith('claude-haiku-5-5', {}, { timeout: 3000, maxRetries: 0 });
    });

    it('is down with the models the provider lacks', async () => {
      settings.findAll.mockResolvedValue({ models: ['claude-haiku-5-5', 'claude-old'], missingSteps: [] });
      sdk.retrieve.mockImplementation(async (model: string) =>
        model === 'claude-old' ? Promise.reject(new Error('404 not_found')) : { id: model }
      );

      await expect(subjectUnderTest.checkHealth(3000)).resolves.toMatchObject({
        up: false,
        missingModels: ['claude-old'],
        reason: '404 not_found'
      });
    });

    it('is down when a step has no settings', async () => {
      settings.findAll.mockResolvedValue({ models: [], missingSteps: [LLMStepEnum.MAIL] });

      await expect(subjectUnderTest.checkHealth(3000)).resolves.toMatchObject({ up: false, missingSettings: [LLMStepEnum.MAIL] });
    });
  });
});
