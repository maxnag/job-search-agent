import { type DeepMocked, createMock } from '@golevelup/ts-vitest';
import { Logger } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { type Job, UnrecoverableError } from 'bullmq';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { JobNameEnum } from '@job-agent/shared';

import { CrawlErrorCodeEnum } from '../../crawler/enums/crawl-error-code.enum.js';
import { CrawlError } from '../../crawler/errors/crawl.error.js';
import { DiscoveryOrchestrator } from '../../discovery/services/discovery.orchestrator.js';
import { SourceScanOutcomeEnum } from '../enums/source-scan-outcome.enum.js';
import type { IScanSourceJob } from '../interfaces/scan-source-job.interface.js';
import { SourceScanOrchestrator } from '../services/source-scan.orchestrator.js';
import { SearchConsumer } from './search.consumer.js';

const SUMMARY = {
  sourceId: 1,
  outcome: SourceScanOutcomeEnum.SCANNED,
  links: 3,
  positions: 2,
  created: 2,
  skipped: 1,
  closed: 0,
  queued: 1
};

/**
 * A search job
 *
 * @param {JobNameEnum} name
 *
 * @returns {Job<IScanSourceJob, unknown, JobNameEnum>}
 */
function job(name: JobNameEnum): Job<IScanSourceJob, unknown, JobNameEnum> {
  return createMock<Job<IScanSourceJob, unknown, JobNameEnum>>({
    id: '1',
    name,
    data: { sourceId: 1 },
    attemptsMade: 1,
    opts: { attempts: 3 }
  });
}

describe('SearchConsumer (unit)', () => {
  let moduleFixture: TestingModule;
  let subjectUnderTest: SearchConsumer;
  let orchestrator: DeepMocked<SourceScanOrchestrator>;

  beforeEach(async () => {
    orchestrator = createMock<SourceScanOrchestrator>();
    moduleFixture = await Test.createTestingModule({
      providers: [
        SearchConsumer,
        { provide: SourceScanOrchestrator, useValue: orchestrator },
        { provide: DiscoveryOrchestrator, useValue: {} }
      ]
    }).compile();

    subjectUnderTest = moduleFixture.get(SearchConsumer);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await moduleFixture.close();
  });

  it('should be defined', () => {
    expect(subjectUnderTest).toBeDefined();
  });

  describe('process', () => {
    it('queues the scans of the schedule', async () => {
      orchestrator.queueScans.mockResolvedValue(2);

      await expect(subjectUnderTest.process(job(JobNameEnum.SCAN_SOURCES))).resolves.toBe(2);
    });

    it('scans one source', async () => {
      orchestrator.scan.mockResolvedValue(SUMMARY);

      await expect(subjectUnderTest.process(job(JobNameEnum.SCAN_SOURCE))).resolves.toEqual(SUMMARY);
      expect(orchestrator.scan).toHaveBeenCalledWith({ sourceId: 1 });
    });

    it('refuses an unknown job for good', async () => {
      await expect(subjectUnderTest.process(job(JobNameEnum.EXTRACT_VACANCY))).rejects.toThrow('JOB_NAME_UNKNOWN: extract-vacancy');
    });

    it('retries a transient failure and stops on a permanent one', async () => {
      const transient = new CrawlError(CrawlErrorCodeEnum.FETCH_FAILED, 'timeout');

      orchestrator.scan.mockRejectedValueOnce(transient);
      await expect(subjectUnderTest.process(job(JobNameEnum.SCAN_SOURCE))).rejects.toBe(transient);

      orchestrator.scan.mockRejectedValueOnce(new Error('SOURCE_NOT_FOUND: 1'));
      await expect(subjectUnderTest.process(job(JobNameEnum.SCAN_SOURCE))).rejects.toThrow(UnrecoverableError);
    });
  });

  it('onFailed warns about a retry', () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    subjectUnderTest.onFailed(job(JobNameEnum.SCAN_SOURCE), new Error('timeout'));

    expect(warn).toHaveBeenCalledWith(expect.objectContaining({ message: 'Job will be retried' }));
  });

  it('onCompleted logs the job at debug level', () => {
    const debug = vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);

    subjectUnderTest.onCompleted(job(JobNameEnum.SCAN_SOURCE));

    expect(debug).toHaveBeenCalledWith({ message: 'Search job completed', job: JobNameEnum.SCAN_SOURCE, jobId: '1' });
  });
});
