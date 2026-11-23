import { type DeepMocked, createMock } from '@golevelup/ts-vitest';
import { getQueueToken } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import type { Queue } from 'bullmq';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { JobNameEnum, QueueNameEnum, SchedulerIdEnum } from '@job-agent/shared';

import { createConfigMock } from '../../../../test/config-service.mock.js';
import { SearchScheduler } from './search.scheduler.js';

describe('SearchScheduler (unit)', () => {
  let moduleFixture: TestingModule;
  let subjectUnderTest: SearchScheduler;
  let queue: DeepMocked<Queue>;

  beforeEach(async () => {
    queue = createMock<Queue>();
    moduleFixture = await Test.createTestingModule({
      providers: [
        SearchScheduler,
        { provide: getQueueToken(QueueNameEnum.SEARCH), useValue: queue },
        { provide: ConfigService, useValue: createConfigMock({ SEARCH_INTERVAL_HOURS: 6 }) }
      ]
    }).compile();

    subjectUnderTest = moduleFixture.get(SearchScheduler);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await moduleFixture.close();
  });

  it('should be defined', () => {
    expect(subjectUnderTest).toBeDefined();
  });

  it('schedules the scans of all sources every configured number of hours', async () => {
    subjectUnderTest.onApplicationBootstrap();

    await vi.waitFor(() => {
      expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
        SchedulerIdEnum.SCAN_SOURCES,
        { every: 21_600_000 },
        { name: JobNameEnum.SCAN_SOURCES }
      );
    });
  });

  it('logs a failed schedule instead of crashing the start', async () => {
    const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    queue.upsertJobScheduler.mockRejectedValue(new Error('Redis down'));
    subjectUnderTest.onApplicationBootstrap();

    await vi.waitFor(() => {
      expect(error).toHaveBeenCalledWith('Source scans not scheduled: Redis down', expect.any(String));
    });
  });
});
