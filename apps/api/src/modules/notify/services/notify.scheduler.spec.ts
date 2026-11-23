import { type DeepMocked, createMock } from '@golevelup/ts-vitest';
import { getQueueToken } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import type { Queue } from 'bullmq';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { JobNameEnum, QueueNameEnum, SchedulerIdEnum } from '@job-agent/shared';

import { createConfigMock } from '../../../../test/config-service.mock.js';
import { NotifyScheduler } from './notify.scheduler.js';

describe('NotifyScheduler (unit)', () => {
  let moduleFixture: TestingModule;
  let subjectUnderTest: NotifyScheduler;
  let queue: DeepMocked<Queue>;

  beforeEach(async () => {
    queue = createMock<Queue>();
    moduleFixture = await Test.createTestingModule({
      providers: [
        NotifyScheduler,
        { provide: getQueueToken(QueueNameEnum.NOTIFY), useValue: queue },
        { provide: ConfigService, useValue: createConfigMock({ NOTIFY_SWEEP_MINUTES: 15 }) }
      ]
    }).compile();

    subjectUnderTest = moduleFixture.get(NotifyScheduler);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await moduleFixture.close();
  });

  it('should be defined', () => {
    expect(subjectUnderTest).toBeDefined();
  });

  it('schedules the sweep of pending cards every configured number of minutes', async () => {
    subjectUnderTest.onApplicationBootstrap();

    await vi.waitFor(() => {
      expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
        SchedulerIdEnum.NOTIFY_PENDING,
        { every: 900_000 },
        { name: JobNameEnum.NOTIFY_PENDING }
      );
    });
  });

  it('logs a failed schedule instead of crashing the start', async () => {
    const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    queue.upsertJobScheduler.mockRejectedValue(new Error('Redis down'));
    subjectUnderTest.onApplicationBootstrap();

    await vi.waitFor(() => {
      expect(error).toHaveBeenCalledWith('Pending cards sweep not scheduled: Redis down', expect.any(String));
    });
  });
});
