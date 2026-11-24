import type { SourceFetchModeEnum } from '@job-agent/shared';

import type { IFetchedPage } from './fetched-page.interface.js';

/**
 * Loads a page one way; politeness (robots.txt, pauses, refusals) belongs to the crawler, not to a fetcher
 */
export interface IPageFetcher {
  /**
   * The `source_fetch_mode` the fetcher serves
   *
   * @var {SourceFetchModeEnum}
   */
  readonly mode: SourceFetchModeEnum;

  /**
   * Load the page
   *
   * @param {URL} url
   * @param {number} [timeoutMs] Limit of this request instead of the mode's own
   *
   * @returns {Promise<IFetchedPage>}
   */
  fetch(url: URL, timeoutMs?: number): Promise<IFetchedPage>;
}
