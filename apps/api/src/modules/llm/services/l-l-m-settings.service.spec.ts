import { type DeepMocked, createMock } from '@golevelup/ts-vitest';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LLMProviderEnum, LLMStepEnum } from '@job-agent/shared';

import { createConfigMock } from '../../../../test/config-service.mock.js';
import type { LLMSettingRowType } from '../interfaces/l-l-m-setting-row.interface.js';
import { LLMSettingsRepository } from '../repositories/l-l-m-settings.repository.js';
import { anthropicParamsSchema } from '../schemas/anthropic-params.schema.js';
import { LLMSettingsService } from './l-l-m-settings.service.js';

const row = (step: LLMStepEnum, params: Record<string, unknown>, model = 'claude-haiku-5-5'): LLMSettingRowType => ({
  llm_setting_id: 1,
  llm_setting_provider: LLMProviderEnum.ANTHROPIC,
  llm_setting_step: step,
  llm_setting_model: model,
  llm_setting_params: params,
  dt_create: new Date(),
  dt_update: null
});

describe('LLMSettingsService (unit)', () => {
  let moduleFixture: TestingModule;
  let subjectUnderTest: LLMSettingsService;
  let repository: DeepMocked<LLMSettingsRepository>;

  beforeEach(async () => {
    moduleFixture = await Test.createTestingModule({
      providers: [
        LLMSettingsService,
        { provide: LLMSettingsRepository, useValue: createMock<LLMSettingsRepository>() },
        { provide: ConfigService, useValue: createConfigMock({ LLM_PROVIDER: LLMProviderEnum.ANTHROPIC }) }
      ]
    }).compile();

    subjectUnderTest = moduleFixture.get(LLMSettingsService);
    repository = moduleFixture.get(LLMSettingsRepository);
  });

  afterEach(async () => {
    await moduleFixture.close();
  });

  it('should be defined', () => {
    expect(subjectUnderTest).toBeDefined();
  });

  describe('findOne', () => {
    it('reads the row of the provider in use and validates its params', async () => {
      repository.findOne.mockResolvedValue(row(LLMStepEnum.RESUME, { max_tokens: 8192, thinking: 'disabled' }));

      await expect(subjectUnderTest.findOne(LLMStepEnum.RESUME, anthropicParamsSchema)).resolves.toEqual({
        step: LLMStepEnum.RESUME,
        model: 'claude-haiku-5-5',
        params: { max_tokens: 8192, thinking: 'disabled' }
      });
      expect(repository.findOne).toHaveBeenCalledWith(LLMProviderEnum.ANTHROPIC, LLMStepEnum.RESUME);
    });

    it('names the provider and the step without a row', async () => {
      repository.findOne.mockResolvedValue(undefined);

      await expect(subjectUnderTest.findOne(LLMStepEnum.MAIL, anthropicParamsSchema)).rejects.toThrow(
        'LLM_SETTINGS_MISSING: no llm_settings row for anthropic/mail'
      );
    });

    it.each([
      ['without max_tokens', { thinking: 'disabled' }],
      ['with effort but no adaptive thinking', { max_tokens: 1, thinking: 'disabled', effort: 'high' }],
      ['with a temperature Anthropic does not take', { max_tokens: 1, thinking: 'disabled', temperature: 0 }]
    ])('rejects params %s', async (_case, params) => {
      repository.findOne.mockResolvedValue(row(LLMStepEnum.RESUME, params));

      await expect(subjectUnderTest.findOne(LLMStepEnum.RESUME, anthropicParamsSchema)).rejects.toThrow(
        'LLM_SETTINGS_INVALID: llm_setting_params of anthropic/resume'
      );
    });
  });

  describe('findAll', () => {
    it('lists the distinct models and the steps without a row', async () => {
      repository.findAll.mockResolvedValue([
        row(LLMStepEnum.RESUME, {}),
        row(LLMStepEnum.EXTRACT, {}),
        row(LLMStepEnum.MAIL, {}, 'claude-sonnet-5-5')
      ]);

      await expect(subjectUnderTest.findAll()).resolves.toEqual({
        models: ['claude-haiku-5-5', 'claude-sonnet-5-5'],
        missingSteps: [LLMStepEnum.LISTING, LLMStepEnum.NAVIGATION]
      });
    });
  });
});
