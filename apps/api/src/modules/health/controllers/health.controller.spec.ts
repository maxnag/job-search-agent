import { type DeepMocked, createMock } from '@golevelup/ts-vitest';
import { ServiceUnavailableException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { HealthService } from '../services/health.service.js';
import { HealthController } from './health.controller.js';

describe('HealthController (unit)', () => {
  let moduleFixture: TestingModule;
  let subjectUnderTest: HealthController;
  let health: DeepMocked<HealthService>;

  beforeEach(async () => {
    health = createMock<HealthService>();
    moduleFixture = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: health }]
    }).compile();

    subjectUnderTest = moduleFixture.get(HealthController);
  });

  afterEach(async () => {
    await moduleFixture.close();
  });

  it('should be defined', () => {
    expect(subjectUnderTest).toBeDefined();
  });

  it('answers the report when the application is healthy', async () => {
    health.check.mockResolvedValue({ status: 'ok', version: '1.2.3' });

    await expect(subjectUnderTest.check()).resolves.toEqual({ status: 'ok', version: '1.2.3' });
  });

  it('answers 503 with the same report when it is not', async () => {
    health.check.mockResolvedValue({ status: 'error', version: '1.2.3' });

    const error = await subjectUnderTest.check().catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as ServiceUnavailableException).getResponse()).toEqual({ status: 'error', version: '1.2.3' });
  });
});
