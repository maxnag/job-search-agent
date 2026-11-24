import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { type Job, UnrecoverableError } from 'bullmq';
import { GrammyError } from 'grammy';

import { JobNameEnum } from '@job-agent/shared';

import { toJobError } from '../../queues/helpers/job-error.helper.js';
import { logJobFailure } from '../../queues/helpers/job-failure.helper.js';
import type { ISourceBlockedJob } from '../../vacancies/interfaces/source-blocked-job.interface.js';
import type { ISourceCandidateJob } from '../../vacancies/interfaces/source-candidate-job.interface.js';
import type { IVacancyJob } from '../../vacancies/interfaces/vacancy-job.interface.js';
import type { IVacancyMatchJob } from '../../vacancies/interfaces/vacancy-match-job.interface.js';
import { NotificationService } from '../services/notification.service.js';

/**
 * Telegram answers a retry cannot change: a malformed message, a wrong token (401, 404), a chat the bot cannot write to
 *
 * @type {ReadonlySet<number>}
 */
const PERMANENT_TELEGRAM_CODES: ReadonlySet<number> = new Set([400, 401, 403, 404]);

/**
 * Data of any `notify` job
 */
type NotifyJobDataType = Partial<IVacancyJob & IVacancyMatchJob & ISourceBlockedJob & ISourceCandidateJob>;

/**
 * Worker of the `notify` queue: one message at a time, at most one a second — the pace Telegram allows a chat
 */
@Processor('notify', { concurrency: 1, limiter: { max: 1, duration: 1000 } })
export class NotifyConsumer extends WorkerHost {
  /**
   * Logger
   *
   * @var {Logger}
   */
  private readonly logger = new Logger(NotifyConsumer.name);

  /**
   * @param {NotificationService} notificationService
   */
  constructor(private readonly notificationService: NotificationService) {
    super();
  }

  /**
   * Send the message of the job
   *
   * @param {Job<NotifyJobDataType, unknown, JobNameEnum>} job
   *
   * @throws {UnrecoverableError} For an unknown job, a missing configuration or a refusal Telegram keeps giving
   * @throws {Error} For a transient failure — retried with backoff
   *
   * @returns {Promise<boolean | number>}
   */
  async process(job: Job<NotifyJobDataType, unknown, JobNameEnum>): Promise<boolean | number> {
    try {
      return await this.dispatch(job);
    } catch (error) {
      if (error instanceof GrammyError && PERMANENT_TELEGRAM_CODES.has(error.error_code)) {
        throw new UnrecoverableError(`TELEGRAM_REFUSED: ${error.error_code} ${error.description}`);
      }

      if (error instanceof Error && error.message.startsWith('TELEGRAM_NOT_CONFIGURED:')) {
        throw new UnrecoverableError(error.message);
      }

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
    this.logger.debug({ message: 'Notify job completed', job: job.name, jobId: job.id });
  }

  /**
   * Run a job by its name
   *
   * @param {Job<NotifyJobDataType, unknown, JobNameEnum>} job
   *
   * @throws {UnrecoverableError} For an unknown job
   *
   * @returns {Promise<boolean | number>}
   */
  private async dispatch(job: Job<NotifyJobDataType, unknown, JobNameEnum>): Promise<boolean | number> {
    const { data } = job;

    switch (job.name) {
      case JobNameEnum.VACANCY_MATCHED:
        return this.notificationService.sendMatch(data.vacancyMatchId ?? 0);
      case JobNameEnum.VACANCY_CLOSED:
        return this.notificationService.sendClosed(data.vacancyId ?? 0);
      case JobNameEnum.VACANCY_CHANGED:
        return this.notificationService.sendChanged(data.vacancyId ?? 0);
      case JobNameEnum.SOURCE_BLOCKED:
        return this.notificationService.sendSourceBlocked(data.sourceId ?? 0);

      case JobNameEnum.SOURCE_CANDIDATE:
        return this.notificationService.sendSourceCandidate(data.sourceCandidateId ?? 0);
      case JobNameEnum.NOTIFY_PENDING:
        return this.notificationService.queuePending();
      default:
        throw new UnrecoverableError(`JOB_NAME_UNKNOWN: ${job.name}`);
    }
  }
}
