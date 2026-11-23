import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { llmSettings, truncateTables } from '@job-agent/db';
import { LLMProviderEnum, LLMStepEnum } from '@job-agent/shared';

import { testDatabaseProvider } from '../../../../test/test-database.provider.js';
import { DatabaseService } from '../../database/services/database.service.js';
import { LLMSettingsRepository } from './l-l-m-settings.repository.js';

describe('LLMSettingsRepository (e2e)', () => {
  let moduleFixture: TestingModule;
  let repository: LLMSettingsRepository;
  let databaseService: DatabaseService;

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({ providers: [LLMSettingsRepository, testDatabaseProvider()] }).compile();

    repository = moduleFixture.get(LLMSettingsRepository);
    databaseService = moduleFixture.get(DatabaseService);
  });

  beforeEach(async () => {
    await truncateTables(databaseService.db, [llmSettings]);
    await databaseService.db.insert(llmSettings).values([
      { llm_setting_provider: LLMProviderEnum.ANTHROPIC, llm_setting_step: LLMStepEnum.RESUME, llm_setting_model: 'cloud-model' },
      { llm_setting_provider: LLMProviderEnum.ANTHROPIC, llm_setting_step: LLMStepEnum.EXTRACT, llm_setting_model: 'cloud-model' },
      {
        llm_setting_provider: LLMProviderEnum.OLLAMA,
        llm_setting_step: LLMStepEnum.RESUME,
        llm_setting_model: 'local-model',
        llm_setting_params: { num_predict: 512 }
      }
    ]);
  });

  afterAll(async () => {
    await moduleFixture.close();
  });

  describe('findOne', () => {
    it('finds the row of the provider and the step', async () => {
      const row = await repository.findOne(LLMProviderEnum.OLLAMA, LLMStepEnum.RESUME);

      expect(row?.llm_setting_model).toBe('local-model');
      expect(row?.llm_setting_params).toEqual({ num_predict: 512 });
    });

    it('finds nothing for a step the provider has no row for', async () => {
      await expect(repository.findOne(LLMProviderEnum.OLLAMA, LLMStepEnum.EXTRACT)).resolves.toBeUndefined();
    });
  });

  describe('findAll', () => {
    it('returns only the rows of the provider', async () => {
      const rows = await repository.findAll(LLMProviderEnum.ANTHROPIC);

      expect(rows.map(row => row.llm_setting_step).sort((left, right) => left.localeCompare(right))).toEqual([
        LLMStepEnum.EXTRACT,
        LLMStepEnum.RESUME
      ]);
      expect(rows.every(row => row.llm_setting_provider === LLMProviderEnum.ANTHROPIC)).toBe(true);
    });

    it('returns an empty list for a provider without rows', async () => {
      await truncateTables(databaseService.db, [llmSettings]);

      await expect(repository.findAll(LLMProviderEnum.OLLAMA)).resolves.toEqual([]);
    });
  });
});
