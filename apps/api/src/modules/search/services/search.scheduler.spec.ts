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

  /**
   * Build the scheduler with the given web search key
   *
   * @param {string | undefined} key
   *
   * @returns {Promise<void>}
   */
  async function compile(key: string | undefined): Promise<void> {
    moduleFixture = await Test.createTestingModule({
      providers: [
        SearchScheduler,
        { provide: getQueueToken(QueueNameEnum.SEARCH), useValue: queue },
        {
          provide: ConfigService,
          useValue: createConfigMock({ SEARCH_INTERVAL_HOURS: 6, DISCOVER_CRON: '0 7 * * 1', BRAVE_SEARCH_API_KEY: key })
        }
      ]
    }).compile();

    subjectUnderTest = moduleFixture.get(SearchScheduler);
  }

  beforeEach(async () => {
    queue = createMock<Queue>();
    await compile(undefined);
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

  describe('the discovery', () => {
    it('is scheduled by its cron when the web search has a key', async () => {
      const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

      await moduleFixture.close();
      await compile('test-key');
      subjectUnderTest.onApplicationBootstrap();

      await vi.waitFor(() => {
        expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
          SchedulerIdEnum.DISCOVER_SOURCES,
          { pattern: '0 7 * * 1' },
          { name: JobNameEnum.DISCOVER_SOURCES }
        );
      });
      expect(log).toHaveBeenCalledWith({ message: 'Discovery scheduled', cron: '0 7 * * 1' });
      expect(queue.removeJobScheduler).not.toHaveBeenCalled();
    });

    it('is unscheduled with one warning when the web search has no key', async () => {
      const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

      subjectUnderTest.onApplicationBootstrap();

      await vi.waitFor(() => {
        expect(queue.removeJobScheduler).toHaveBeenCalledWith(SchedulerIdEnum.DISCOVER_SOURCES);
      });
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith({ message: 'Discovery not scheduled: BRAVE_SEARCH_API_KEY is not set' });
      expect(queue.upsertJobScheduler).not.toHaveBeenCalledWith(SchedulerIdEnum.DISCOVER_SOURCES, expect.anything(), expect.anything());
    });

    it('logs a failed schedule instead of crashing the start', async () => {
      const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

      queue.removeJobScheduler.mockRejectedValue(new Error('Redis down'));
      subjectUnderTest.onApplicationBootstrap();

      await vi.waitFor(() => {
        expect(error).toHaveBeenCalledWith('Discovery not scheduled: Redis down', expect.any(String));
      });
    });
  });
});
