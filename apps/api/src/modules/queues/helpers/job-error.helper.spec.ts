import { UnrecoverableError } from 'bullmq';
import { describe, expect, it } from 'vitest';

import { CrawlErrorCodeEnum } from '../../crawler/enums/crawl-error-code.enum.js';
import { CrawlError } from '../../crawler/errors/crawl.error.js';
import { toJobError } from './job-error.helper.js';

describe('toJobError', () => {
  it('keeps a transient crawl failure retryable', () => {
    const error = new CrawlError(CrawlErrorCodeEnum.FETCH_FAILED, 'timeout');

    expect(toJobError(error)).toBe(error);
  });

  it.each([CrawlErrorCodeEnum.ROBOTS_DISALLOWED, CrawlErrorCodeEnum.PRIVATE_ADDRESS, CrawlErrorCodeEnum.FETCH_HTTP_ERROR])(
    'stops the retries of a %s crawl failure',
    code => {
      const result = toJobError(new CrawlError(code, 'careers.example.com'));

      expect(result).toBeInstanceOf(UnrecoverableError);
      expect(result.message).toBe(`${code}: careers.example.com`);
    }
  );

  it.each(['LLM_OUTPUT_SCHEMA_INVALID', 'LLM_OUTPUT_TRUNCATED', 'PROFILE_PREFERENCES_INVALID', 'SOURCE_NOT_FOUND', 'VACANCY_NOT_FOUND'])(
    'stops the retries of a %s error',
    code => {
      expect(toJobError(new Error(`${code}: details`))).toBeInstanceOf(UnrecoverableError);
    }
  );

  it('keeps any other error retryable, a code only mentioned inside the message too', () => {
    const error = new Error('Ollama busy, not VACANCY_NOT_FOUND: x');

    expect(toJobError(error)).toBe(error);
  });

  it('wraps a thrown value that is not an error', () => {
    const result = toJobError('boom');

    expect(result).toBeInstanceOf(Error);
    expect(result).not.toBeInstanceOf(UnrecoverableError);
    expect(result.message).toBe('boom');
  });
});
