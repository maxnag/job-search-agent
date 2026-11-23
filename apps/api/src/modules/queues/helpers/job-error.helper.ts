import { UnrecoverableError } from 'bullmq';

import { CrawlError } from '../../crawler/errors/crawl.error.js';

/**
 * Codes of errors another attempt cannot fix
 *
 * @type {readonly string[]}
 */
const PERMANENT_CODES: readonly string[] = [
  'LLM_OUTPUT_SCHEMA_INVALID',
  'LLM_OUTPUT_TRUNCATED',
  'PROFILE_PREFERENCES_INVALID',
  'SOURCE_NOT_FOUND',
  'VACANCY_NOT_FOUND'
];

/**
 * The error a job throws: a permanent one becomes `UnrecoverableError`, so BullMQ fails the job without retrying it;
 * a transient one is kept and retried
 *
 * @param {unknown} error
 *
 * @returns {Error}
 */
export function toJobError(error: unknown): Error {
  if (error instanceof CrawlError) {
    return error.isRetryable ? error : new UnrecoverableError(error.message);
  }

  if (!(error instanceof Error)) {
    return new Error(String(error));
  }

  return PERMANENT_CODES.some(code => error.message.startsWith(`${code}:`)) ? new UnrecoverableError(error.message) : error;
}
