import type { SourceFetchModeEnum } from '@job-agent/shared';

import type { IPageFetcher } from '../interfaces/page-fetcher.interface.js';

/**
 * Picks the fetcher of a source by its `source_fetch_mode`
 */
export class PageFetcherRegistry {
  /**
   * Fetcher of every registered mode
   *
   * @var {ReadonlyMap<SourceFetchModeEnum, IPageFetcher>}
   */
  private readonly fetchers: ReadonlyMap<SourceFetchModeEnum, IPageFetcher>;

  /**
   * @param {readonly IPageFetcher[]} fetchers
   *
   * @throws {Error} `PAGE_FETCHER_DUPLICATE` if two fetchers claim one mode
   */
  constructor(fetchers: readonly IPageFetcher[]) {
    const byMode = new Map<SourceFetchModeEnum, IPageFetcher>();

    for (const fetcher of fetchers) {
      const owner = byMode.get(fetcher.mode);

      if (owner) {
        throw new Error(
          `PAGE_FETCHER_DUPLICATE: ${fetcher.mode} is served by both ${owner.constructor.name} and ${fetcher.constructor.name}`
        );
      }

      byMode.set(fetcher.mode, fetcher);
    }

    this.fetchers = byMode;
  }

  /**
   * Fetcher of a mode
   *
   * @param {SourceFetchModeEnum} mode
   *
   * @throws {Error} `PAGE_FETCH_MODE_UNSUPPORTED` if no fetcher serves the mode
   *
   * @returns {IPageFetcher}
   */
  findOne(mode: SourceFetchModeEnum): IPageFetcher {
    const fetcher = this.fetchers.get(mode);

    if (!fetcher) {
      throw new Error(`PAGE_FETCH_MODE_UNSUPPORTED: "${mode}" — supported: ${[...this.fetchers.keys()].join(', ')}`);
    }

    return fetcher;
  }
}
