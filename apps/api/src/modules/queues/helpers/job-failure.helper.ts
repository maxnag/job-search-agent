import type { Logger } from '@nestjs/common';
import { type Job, UnrecoverableError } from 'bullmq';

/**
 * Log a failed attempt of a job: a warning while retries remain, an error once the job is given up
 *
 * @param {Logger} logger
 * @param {Job | undefined} job
 * @param {Error} error
 *
 * @returns {void}
 */
export function logJobFailure(logger: Logger, job: Job | undefined, error: Error): void {
  const attempts = job?.opts.attempts ?? 1;
  const givenUp = !job || error instanceof UnrecoverableError || job.attemptsMade >= attempts;

  if (givenUp) {
    logger.error(`Job ${job?.name ?? 'unknown'} ${job?.id ?? ''} failed: ${error.message}`, error.stack);

    return;
  }

  logger.warn({ message: 'Job will be retried', job: job.name, jobId: job.id, attempt: job.attemptsMade, attempts, reason: error.message });
}
