import { UnrecoverableError } from 'bullmq';

import { CrawlError } from '../../crawler/errors/crawl.error.js';

/**
 * Codes of errors another attempt cannot fix
 *
 * @type {readonly string[]}
 */
const PERMANENT_CODES: readonly string[] = [
  'ATS_POSTING_UNKNOWN',
  'ATS_RESPONSE_INVALID',
  'BRAVE_SEARCH_DISABLED',
  'BRAVE_SEARCH_UNAUTHORIZED',
  'JOB_MAIL_AUTH_FAILED',
  'JOB_MAIL_MESSAGE_GONE',
  'JOB_MAIL_NOT_CONFIGURED',
  'LLM_OUTPUT_SCHEMA_INVALID',
  'LLM_OUTPUT_TRUNCATED',
  'PROFILE_PREFERENCES_INVALID',
  'SOURCE_NOT_FOUND',
  'SOURCE_URL_NOT_ATS',
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
