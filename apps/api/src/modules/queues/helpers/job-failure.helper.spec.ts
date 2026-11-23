import { createMock } from '@golevelup/ts-vitest';
import { Logger } from '@nestjs/common';
import { type Job, UnrecoverableError } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';

import { logJobFailure } from './job-failure.helper.js';

/**
 * A job after the given attempts out of the allowed ones
 *
 * @param {number} attemptsMade
 * @param {number | undefined} attempts
 *
 * @returns {Job}
 */
function job(attemptsMade: number, attempts: number | undefined): Job {
  return createMock<Job>({ id: '42', name: 'extract-vacancy', attemptsMade, opts: { attempts } });
}

describe('logJobFailure', () => {
  it('warns about a failure that will be retried', () => {
    const logger = new Logger('test');
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined);

    logJobFailure(logger, job(1, 3), new Error('timeout'));

    expect(warn).toHaveBeenCalledWith({
      message: 'Job will be retried',
      job: 'extract-vacancy',
      jobId: '42',
      attempt: 1,
      attempts: 3,
      reason: 'timeout'
    });
    expect(error).not.toHaveBeenCalled();
  });

  it('logs an error once the last attempt failed', () => {
    const logger = new Logger('test');
    const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    const failure = new Error('timeout');

    logJobFailure(logger, job(3, 3), failure);

    expect(error).toHaveBeenCalledWith('Job extract-vacancy 42 failed: timeout', failure.stack);
  });

  it('logs an error at once for a failure that is not retried', () => {
    const logger = new Logger('test');
    const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined);

    logJobFailure(logger, job(1, 3), new UnrecoverableError('VACANCY_NOT_FOUND: 7'));

    expect(error).toHaveBeenCalledTimes(1);
  });

  it('treats a job without attempts as a single one', () => {
    const logger = new Logger('test');
    const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined);

    logJobFailure(logger, job(1, undefined), new Error('x'));

    expect(error).toHaveBeenCalledTimes(1);
  });

  it('logs an error when the job is unknown', () => {
    const logger = new Logger('test');
    const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined);

    logJobFailure(logger, undefined, new Error('lost'));

    expect(error).toHaveBeenCalledWith('Job unknown  failed: lost', expect.any(String));
  });
});
