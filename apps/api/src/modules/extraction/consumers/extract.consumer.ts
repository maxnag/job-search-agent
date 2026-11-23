import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Job, UnrecoverableError } from 'bullmq';

import { JobNameEnum } from '@job-agent/shared';

import type { IEnv } from '../../../config/env.schema.js';
import { toJobError } from '../../queues/helpers/job-error.helper.js';
import { logJobFailure } from '../../queues/helpers/job-failure.helper.js';
import type { IVacancyJob } from '../../vacancies/interfaces/vacancy-job.interface.js';
import type { IVacancyExtractionSummary } from '../interfaces/vacancy-extraction-summary.interface.js';
import { VacancyExtractionOrchestrator } from '../services/vacancy-extraction.orchestrator.js';

/**
 * Worker of the `extract` queue; its concurrency is `EXTRACT_CONCURRENCY` — 1 for Ollama, more for the cloud
 */
@Processor('extract')
export class ExtractConsumer extends WorkerHost implements OnApplicationBootstrap {
  /**
   * Logger
   *
   * @var {Logger}
   */
  private readonly logger = new Logger(ExtractConsumer.name);

  /**
   * @param {VacancyExtractionOrchestrator} vacancyExtractionOrchestrator
   * @param {ConfigService<IEnv, true>} configService
   */
  constructor(
    private readonly vacancyExtractionOrchestrator: VacancyExtractionOrchestrator,
    private readonly configService: ConfigService<IEnv, true>
  ) {
    super();
  }

  /**
   * Set the concurrency from the environment — a decorator argument cannot read the configuration
   *
   * @returns {void}
   */
  onApplicationBootstrap(): void {
    this.worker.concurrency = this.configService.get('EXTRACT_CONCURRENCY', { infer: true });
  }

  /**
   * Extract the vacancy of the job
   *
   * @param {Job<IVacancyJob, unknown, JobNameEnum>} job
   *
   * @throws {UnrecoverableError} For an unknown job or a permanent failure — no retry
   * @throws {Error} For a transient failure — retried with backoff
   *
   * @returns {Promise<IVacancyExtractionSummary>}
   */
  async process(job: Job<IVacancyJob, unknown, JobNameEnum>): Promise<IVacancyExtractionSummary> {
    if (job.name !== JobNameEnum.EXTRACT_VACANCY) {
      throw new UnrecoverableError(`JOB_NAME_UNKNOWN: ${job.name}`);
    }

    try {
      return await this.vacancyExtractionOrchestrator.extract(job.data.vacancyId);
    } catch (error) {
      throw toJobError(error);
    }
  }

  /**
   * A failed attempt
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
    this.logger.debug({ message: 'Extract job completed', job: job.name, jobId: job.id });
  }
}
