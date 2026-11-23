import { CrawlErrorCodeEnum } from '../enums/crawl-error-code.enum.js';

/**
 * A page that was not fetched, with a code for the caller to act on; the message starts with the code
 */
export class CrawlError extends Error {
  /**
   * @param {CrawlErrorCodeEnum} code
   * @param {string} detail
   * @param {ErrorOptions} [options]
   */
  constructor(
    readonly code: CrawlErrorCodeEnum,
    detail: string,
    options?: ErrorOptions
  ) {
    super(`${code}: ${detail}`, options);
    this.name = CrawlError.name;
  }

  /**
   * True when a later attempt may succeed — the job is retried
   *
   * @returns {boolean}
   */
  get isRetryable(): boolean {
    return this.code === CrawlErrorCodeEnum.FETCH_FAILED;
  }
}
