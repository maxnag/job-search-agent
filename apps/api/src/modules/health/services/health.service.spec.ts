import { type DeepMocked, createMock } from '@golevelup/ts-vitest';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, describe, expect, it } from 'vitest';

import { LLMProviderEnum, LLMStepEnum } from '@job-agent/shared';

import { createConfigMock } from '../../../../test/config-service.mock.js';
import { DatabaseService } from '../../database/services/database.service.js';
import { LLMClient } from '../../llm/clients/l-l-m.client.js';
import { RedisService } from '../../redis/services/redis.service.js';
import { HealthService } from './health.service.js';

describe('HealthService (unit)', () => {
  let moduleFixture: TestingModule;
  let database: DeepMocked<DatabaseService>;
  let redis: DeepMocked<RedisService>;
  let llm: DeepMocked<LLMClient>;

  const create = async (nodeEnv: string): Promise<HealthService> => {
    database = createMock<DatabaseService>();
    redis = createMock<RedisService>();
    llm = createMock<LLMClient>();
    llm.checkHealth.mockResolvedValue({ provider: LLMProviderEnum.ANTHROPIC, up: true, missingModels: [], missingSettings: [] });
    moduleFixture = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: DatabaseService, useValue: database },
        { provide: RedisService, useValue: redis },
        { provide: LLMClient, useValue: llm },
        { provide: ConfigService, useValue: createConfigMock({ NODE_ENV: nodeEnv, APP_VERSION: '1.2.3', HEALTH_CHECK_TIMEOUT_MS: 1000 }) }
      ]
    }).compile();

    return moduleFixture.get(HealthService);
  };

  afterEach(async () => {
    await moduleFixture.close();
  });

  it('should be defined', async () => {
    expect(await create('development')).toBeDefined();
  });

  it('reports every dependency in development', async () => {
    const service = await create('development');

    await expect(service.check()).resolves.toEqual({
      status: 'ok',
      version: '1.2.3',
      checks: { postgres: 'up', redis: 'up', llm: 'up' },
      llm: { provider: LLMProviderEnum.ANTHROPIC, missingModels: [], missingSettings: [] }
    });
  });

  it('shows only the status and the version in production', async () => {
    const service = await create('production');

    await expect(service.check()).resolves.toEqual({ status: 'ok', version: '1.2.3' });
  });

  it.each([
    ['postgres', (): unknown => database.ping.mockRejectedValue(new Error('ECONNREFUSED'))],
    ['redis', (): unknown => redis.ping.mockRejectedValue(new Error('ECONNREFUSED'))]
  ])('is an error when %s is down', async (name, breakIt) => {
    const service = await create('development');

    breakIt();

    await expect(service.check()).resolves.toMatchObject({ status: 'error', checks: { [name]: 'down' } });
  });

  it('stays ok when only the LLM is down', async () => {
    const service = await create('development');

    llm.checkHealth.mockResolvedValue({
      provider: LLMProviderEnum.ANTHROPIC,
      up: false,
      missingModels: [],
      missingSettings: [LLMStepEnum.MAIL]
    });

    await expect(service.check()).resolves.toMatchObject({
      status: 'ok',
      checks: { llm: 'down' },
      llm: { missingSettings: [LLMStepEnum.MAIL] }
    });
  });
});
