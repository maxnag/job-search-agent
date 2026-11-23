import { describe, expect, it } from 'vitest';

import { CrawlErrorCodeEnum } from '../enums/crawl-error-code.enum.js';
import { CrawlError } from './crawl.error.js';

describe('CrawlError', () => {
  it('starts the message with the code and keeps the cause', () => {
    const cause = new Error('socket hang up');
    const error = new CrawlError(CrawlErrorCodeEnum.FETCH_FAILED, 'example.com', { cause });

    expect(error.message).toBe('FETCH_FAILED: example.com');
    expect(error.name).toBe('CrawlError');
    expect(error.code).toBe(CrawlErrorCodeEnum.FETCH_FAILED);
    expect(error.cause).toBe(cause);
  });

  it('is retryable only for a transient failure', () => {
    const retryable = Object.values(CrawlErrorCodeEnum).filter(code => new CrawlError(code, 'x').isRetryable);

    expect(retryable).toEqual([CrawlErrorCodeEnum.FETCH_FAILED]);
  });
});
