import { type DeepMocked, createMock } from '@golevelup/ts-vitest';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { type Job, UnrecoverableError, type Worker } from 'bullmq';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { JobNameEnum } from '@job-agent/shared';

import { createConfigMock } from '../../../../test/config-service.mock.js';
import { CrawlErrorCodeEnum } from '../../crawler/enums/crawl-error-code.enum.js';
import { CrawlError } from '../../crawler/errors/crawl.error.js';
import type { IVacancyJob } from '../../vacancies/interfaces/vacancy-job.interface.js';
import { VacancyExtractionOutcomeEnum } from '../enums/vacancy-extraction-outcome.enum.js';
import { VacancyExtractionOrchestrator } from '../services/vacancy-extraction.orchestrator.js';
import { ExtractConsumer } from './extract.consumer.js';

/**
 * An extract job
 *
 * @param {JobNameEnum} name
 *
 * @returns {Job<IVacancyJob, unknown, JobNameEnum>}
 */
function job(name: JobNameEnum = JobNameEnum.EXTRACT_VACANCY): Job<IVacancyJob, unknown, JobNameEnum> {
  return createMock<Job<IVacancyJob, unknown, JobNameEnum>>({
    id: '1',
    name,
    data: { vacancyId: 7 },
    attemptsMade: 3,
    opts: { attempts: 3 }
  });
}

describe('ExtractConsumer (unit)', () => {
  let moduleFixture: TestingModule;
  let subjectUnderTest: ExtractConsumer;
  let orchestrator: DeepMocked<VacancyExtractionOrchestrator>;

  beforeEach(async () => {
    orchestrator = createMock<VacancyExtractionOrchestrator>();
    moduleFixture = await Test.createTestingModule({
      providers: [
        ExtractConsumer,
        { provide: VacancyExtractionOrchestrator, useValue: orchestrator },
        { provide: ConfigService, useValue: createConfigMock({ EXTRACT_CONCURRENCY: 2 }) }
      ]
    }).compile();

    subjectUnderTest = moduleFixture.get(ExtractConsumer);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await moduleFixture.close();
  });

  it('should be defined', () => {
    expect(subjectUnderTest).toBeDefined();
  });

  it('sets the concurrency of its worker from the configuration at start', () => {
    const worker = { concurrency: 1 } as Worker;

    Object.assign(subjectUnderTest, { _worker: worker });
    subjectUnderTest.onApplicationBootstrap();

    expect(worker.concurrency).toBe(2);
  });

  describe('process', () => {
    it('extracts the vacancy of the job', async () => {
      orchestrator.extract.mockResolvedValue({ vacancyId: 7, outcome: VacancyExtractionOutcomeEnum.EXTRACTED });

      await expect(subjectUnderTest.process(job())).resolves.toEqual({ vacancyId: 7, outcome: VacancyExtractionOutcomeEnum.EXTRACTED });
      expect(orchestrator.extract).toHaveBeenCalledWith(7);
    });

    it('refuses an unknown job for good', async () => {
      await expect(subjectUnderTest.process(job(JobNameEnum.SCAN_SOURCE))).rejects.toThrow(UnrecoverableError);
      expect(orchestrator.extract).not.toHaveBeenCalled();
    });

    it('retries a transient failure', async () => {
      const failure = new CrawlError(CrawlErrorCodeEnum.FETCH_FAILED, 'timeout');

      orchestrator.extract.mockRejectedValue(failure);

      await expect(subjectUnderTest.process(job())).rejects.toBe(failure);
    });

    it('stops the retries of a permanent failure', async () => {
      orchestrator.extract.mockRejectedValue(new Error('VACANCY_NOT_FOUND: 7'));

      await expect(subjectUnderTest.process(job())).rejects.toThrow(UnrecoverableError);
    });
  });

  it('onFailed logs an error after the last attempt', () => {
    const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    subjectUnderTest.onFailed(job(), new Error('timeout'));

    expect(error).toHaveBeenCalledWith('Job extract-vacancy 1 failed: timeout', expect.any(String));
  });

  it('onCompleted logs the job at debug level', () => {
    const debug = vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);

    subjectUnderTest.onCompleted(job());

    expect(debug).toHaveBeenCalledWith({ message: 'Extract job completed', job: JobNameEnum.EXTRACT_VACANCY, jobId: '1' });
  });
});
