import { type DeepMocked, createMock } from '@golevelup/ts-vitest';
import { Logger } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { type Job, UnrecoverableError } from 'bullmq';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { JobNameEnum } from '@job-agent/shared';

import { PipelineEventsService } from '../../vacancies/services/pipeline-events.service.js';
import type { IJobMailReadSummary } from '../interfaces/job-mail-read-summary.interface.js';
import { JobMailReadOrchestrator } from '../services/job-mail-read.orchestrator.js';
import { JobMailScheduler } from '../services/job-mail.scheduler.js';
import { JobMailConsumer } from './job-mail.consumer.js';

/**
 * Result of a reading
 *
 * @type {IJobMailReadSummary}
 */
const SUMMARY: IJobMailReadSummary = {
  since: new Date('2026-11-23T08:00:00Z'),
  mails: 3,
  fresh: 2,
  alerts: 1,
  failed: 0,
  positions: 4,
  created: 4,
  queued: 4
};

/**
 * An e-mail job
 *
 * @param {JobNameEnum} name
 *
 * @returns {Job<unknown, unknown, JobNameEnum>}
 */
function job(name: JobNameEnum): Job<unknown, unknown, JobNameEnum> {
  return createMock<Job<unknown, unknown, JobNameEnum>>({ id: '1', name, data: {}, attemptsMade: 1, opts: { attempts: 3 } });
}

describe('JobMailConsumer (unit)', () => {
  let moduleFixture: TestingModule;
  let subjectUnderTest: JobMailConsumer;
  let orchestrator: DeepMocked<JobMailReadOrchestrator>;
  let events: DeepMocked<PipelineEventsService>;
  let scheduler: DeepMocked<JobMailScheduler>;

  beforeEach(async () => {
    orchestrator = createMock<JobMailReadOrchestrator>();
    events = createMock<PipelineEventsService>();
    scheduler = createMock<JobMailScheduler>();
    moduleFixture = await Test.createTestingModule({
      providers: [
        JobMailConsumer,
        { provide: JobMailReadOrchestrator, useValue: orchestrator },
        { provide: PipelineEventsService, useValue: events },
        { provide: JobMailScheduler, useValue: scheduler }
      ]
    }).compile();

    subjectUnderTest = moduleFixture.get(JobMailConsumer);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await moduleFixture.close();
  });

  it('should be defined', () => {
    expect(subjectUnderTest).toBeDefined();
  });

  describe('process', () => {
    it('reads the mailbox', async () => {
      orchestrator.read.mockResolvedValue(SUMMARY);

      await expect(subjectUnderTest.process(job(JobNameEnum.READ_JOB_MAIL))).resolves.toBe(SUMMARY);
      expect(orchestrator.read).toHaveBeenCalledWith();
    });

    it('refuses an unknown job for good', async () => {
      await expect(subjectUnderTest.process(job(JobNameEnum.SCAN_SOURCE))).rejects.toThrow('JOB_NAME_UNKNOWN: scan-source');
      expect(orchestrator.read).not.toHaveBeenCalled();
    });

    it('retries a transient failure and leaves the schedule in place', async () => {
      const transient = new Error('JOB_MAIL_CONNECTION_FAILED: timeout');

      orchestrator.read.mockRejectedValue(transient);

      await expect(subjectUnderTest.process(job(JobNameEnum.READ_JOB_MAIL))).rejects.toBe(transient);
      expect(scheduler.stop).not.toHaveBeenCalled();
      expect(events.jobMailDisabled).not.toHaveBeenCalled();
    });

    it('stops the schedule and sends one notice when the mailbox refuses the password', async () => {
      orchestrator.read.mockRejectedValue(new Error('JOB_MAIL_AUTH_FAILED: the server refused the account or its app password'));

      await expect(subjectUnderTest.process(job(JobNameEnum.READ_JOB_MAIL))).rejects.toThrow(UnrecoverableError);
      expect(scheduler.stop).toHaveBeenCalledTimes(1);
      expect(events.jobMailDisabled).toHaveBeenCalledTimes(1);
    });
  });

  it('onFailed warns about a retry', () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    subjectUnderTest.onFailed(job(JobNameEnum.READ_JOB_MAIL), new Error('timeout'));

    expect(warn).toHaveBeenCalledWith(expect.objectContaining({ message: 'Job will be retried' }));
  });

  it('onCompleted logs the job at debug level', () => {
    const debug = vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);

    subjectUnderTest.onCompleted(job(JobNameEnum.READ_JOB_MAIL));

    expect(debug).toHaveBeenCalledWith({ message: 'Job mail job completed', job: JobNameEnum.READ_JOB_MAIL, jobId: '1' });
  });
});
