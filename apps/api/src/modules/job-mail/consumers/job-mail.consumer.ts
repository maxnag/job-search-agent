import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { type Job, UnrecoverableError } from 'bullmq';

import { JobNameEnum } from '@job-agent/shared';

import { toJobError } from '../../queues/helpers/job-error.helper.js';
import { logJobFailure } from '../../queues/helpers/job-failure.helper.js';
import { PipelineEventsService } from '../../vacancies/services/pipeline-events.service.js';
import type { IJobMailReadSummary } from '../interfaces/job-mail-read-summary.interface.js';
import { JobMailReadOrchestrator } from '../services/job-mail-read.orchestrator.js';
import { JobMailScheduler } from '../services/job-mail.scheduler.js';

/**
 * Code of the error of a mailbox that refused the account
 *
 * @type {string}
 */
const AUTH_FAILED_CODE = 'JOB_MAIL_AUTH_FAILED';

/**
 * Worker of the `email` queue, one reading at a time. A mailbox that refuses the account stops the schedule and tells
 * the owner once — a retry every half hour would only be refused again
 */
@Processor('email', { concurrency: 1 })
export class JobMailConsumer extends WorkerHost {
  /**
   * Logger
   *
   * @var {Logger}
   */
  private readonly logger = new Logger(JobMailConsumer.name);

  /**
   * @param {JobMailReadOrchestrator} jobMailReadOrchestrator
   * @param {PipelineEventsService} pipelineEventsService
   * @param {JobMailScheduler} jobMailScheduler
   */
  constructor(
    private readonly jobMailReadOrchestrator: JobMailReadOrchestrator,
    private readonly pipelineEventsService: PipelineEventsService,
    private readonly jobMailScheduler: JobMailScheduler
  ) {
    super();
  }

  /**
   * Read the mailbox
   *
   * @param {Job<unknown, unknown, JobNameEnum>} job
   *
   * @throws {UnrecoverableError} For an unknown job or a permanent failure — no retry
   * @throws {Error} For a transient failure — retried with backoff
   *
   * @returns {Promise<IJobMailReadSummary>}
   */
  async process(job: Job<unknown, unknown, JobNameEnum>): Promise<IJobMailReadSummary> {
    if (job.name !== JobNameEnum.READ_JOB_MAIL) {
      throw new UnrecoverableError(`JOB_NAME_UNKNOWN: ${job.name}`);
    }

    try {
      return await this.jobMailReadOrchestrator.read();
    } catch (error) {
      if (error instanceof Error && error.message.startsWith(`${AUTH_FAILED_CODE}:`)) {
        await this.jobMailScheduler.stop();
        await this.pipelineEventsService.jobMailDisabled();
      }

      throw toJobError(error);
    }
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
    this.logger.debug({ message: 'Job mail job completed', job: job.name, jobId: job.id });
  }
}
