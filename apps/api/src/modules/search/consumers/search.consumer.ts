import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { type Job, UnrecoverableError } from 'bullmq';

import { JobNameEnum } from '@job-agent/shared';

import type { IDiscoverySummary } from '../../discovery/interfaces/discovery-summary.interface.js';
import { DiscoveryOrchestrator } from '../../discovery/services/discovery.orchestrator.js';
import { toJobError } from '../../queues/helpers/job-error.helper.js';
import { logJobFailure } from '../../queues/helpers/job-failure.helper.js';
import type { IScanSourceJob } from '../interfaces/scan-source-job.interface.js';
import type { ISourceScanSummary } from '../interfaces/source-scan-summary.interface.js';
import { SourceScanOrchestrator } from '../services/source-scan.orchestrator.js';

/**
 * Worker of the `search` queue, one job at a time: the schedule's fan-out, the scan of each source and the discovery
 * of company boards
 */
@Processor('search', { concurrency: 1 })
export class SearchConsumer extends WorkerHost {
  /**
   * Logger
   *
   * @var {Logger}
   */
  private readonly logger = new Logger(SearchConsumer.name);

  /**
   * @param {SourceScanOrchestrator} sourceScanOrchestrator
   * @param {DiscoveryOrchestrator} discoveryOrchestrator
   */
  constructor(
    private readonly sourceScanOrchestrator: SourceScanOrchestrator,
    private readonly discoveryOrchestrator: DiscoveryOrchestrator
  ) {
    super();
  }

  /**
   * Run a job by its name
   *
   * @param {Job<IScanSourceJob, unknown, JobNameEnum>} job
   *
   * @throws {UnrecoverableError} For an unknown job or a permanent failure — no retry
   * @throws {Error} For a transient failure — retried with backoff
   *
   * @returns {Promise<ISourceScanSummary | IDiscoverySummary | number>}
   */
  async process(job: Job<IScanSourceJob, unknown, JobNameEnum>): Promise<ISourceScanSummary | IDiscoverySummary | number> {
    try {
      if (job.name === JobNameEnum.SCAN_SOURCES) {
        return await this.sourceScanOrchestrator.queueScans();
      }

      if (job.name === JobNameEnum.SCAN_SOURCE) {
        return await this.sourceScanOrchestrator.scan(job.data);
      }

      if (job.name === JobNameEnum.DISCOVER_SOURCES) {
        return await this.discoveryOrchestrator.discover(false);
      }
    } catch (error) {
      throw toJobError(error);
    }

    throw new UnrecoverableError(`JOB_NAME_UNKNOWN: ${job.name}`);
  }

  /**
   * A failed attempt: a warning while retries remain, an error once the job is given up
   *
   * @param {Job | undefined} job
   * @param {Error} error
   *
   * @returns {void}
   */
  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    logJobFailure(this.logger, job, error);
  }

  /**
   * A finished job
   *
   * @param {Job} job
   *
   * @returns {void}
   */
  @OnWorkerEvent('completed')
  onCompleted(job: Job): void {
    this.logger.debug({ message: 'Search job completed', job: job.name, jobId: job.id });
  }
}
