import { type DeepMocked, createMock } from '@golevelup/ts-vitest';
import { getQueueToken } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import type { Queue } from 'bullmq';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { JobNameEnum, QueueNameEnum, SchedulerIdEnum } from '@job-agent/shared';

import { createConfigMock } from '../../../../test/config-service.mock.js';
import { JobMailReadOrchestrator } from './job-mail-read.orchestrator.js';
import { JobMailScheduler } from './job-mail.scheduler.js';

describe('JobMailScheduler (unit)', () => {
  let moduleFixture: TestingModule;
  let subjectUnderTest: JobMailScheduler;
  let queue: DeepMocked<Queue>;
  let orchestrator: DeepMocked<JobMailReadOrchestrator>;

  beforeEach(async () => {
    queue = createMock<Queue>();
    orchestrator = createMock<JobMailReadOrchestrator>();
    orchestrator.isEnabled.mockReturnValue(true);
    moduleFixture = await Test.createTestingModule({
      providers: [
        JobMailScheduler,
        { provide: JobMailReadOrchestrator, useValue: orchestrator },
        { provide: getQueueToken(QueueNameEnum.EMAIL), useValue: queue },
        { provide: ConfigService, useValue: createConfigMock({ JOB_MAIL_INTERVAL_MINUTES: 30 }) }
      ]
    }).compile();

    subjectUnderTest = moduleFixture.get(JobMailScheduler);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await moduleFixture.close();
  });

  it('should be defined', () => {
    expect(subjectUnderTest).toBeDefined();
  });

  it('schedules the reading every JOB_MAIL_INTERVAL_MINUTES', async () => {
    subjectUnderTest.onApplicationBootstrap();

    await vi.waitFor(() => {
      expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
        SchedulerIdEnum.READ_JOB_MAIL,
        { every: 1_800_000 },
        { name: JobNameEnum.READ_JOB_MAIL }
      );
    });
  });

  it('removes the schedule and warns once when the mailbox has no keys', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    orchestrator.isEnabled.mockReturnValue(false);
    subjectUnderTest.onApplicationBootstrap();

    await vi.waitFor(() => {
      expect(warn).toHaveBeenCalledWith({
        message: 'Job mail not scheduled: JOB_MAIL_IMAP_USER and JOB_MAIL_IMAP_PASSWORD are not set'
      });
    });
    expect(queue.removeJobScheduler).toHaveBeenCalledWith(SchedulerIdEnum.READ_JOB_MAIL);
    expect(queue.upsertJobScheduler).not.toHaveBeenCalled();
  });

  it('logs a failed schedule instead of crashing the start', async () => {
    const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    queue.upsertJobScheduler.mockRejectedValue(new Error('Redis down'));
    subjectUnderTest.onApplicationBootstrap();

    await vi.waitFor(() => {
      expect(error).toHaveBeenCalledWith('Job mail not scheduled: Redis down', expect.any(String));
    });
  });

  it('stop removes the schedule', async () => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    await subjectUnderTest.stop();

    expect(queue.removeJobScheduler).toHaveBeenCalledWith(SchedulerIdEnum.READ_JOB_MAIL);
  });
});
