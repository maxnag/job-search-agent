import type { CrawlPaceEnum } from '../enums/crawl-pace.enum.js';

/**
 * Options of one page request
 */
export interface IFetchPageOptions {
  /**
   * Limit of the request instead of the mode's own
   *
   * @var {number | undefined}
   */
  readonly timeoutMs?: number;

  /**
   * Pause before the request to the host, `SITE` when omitted
   *
   * @var {CrawlPaceEnum | undefined}
   */
  readonly pace?: CrawlPaceEnum;
}
