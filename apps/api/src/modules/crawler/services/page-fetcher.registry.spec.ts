import { describe, expect, it } from 'vitest';

import { SourceFetchModeEnum } from '@job-agent/shared';

import type { IPageFetcher } from '../interfaces/page-fetcher.interface.js';
import { PageFetcherRegistry } from './page-fetcher.registry.js';

/**
 * A fetcher of a mode that is never called
 *
 * @param {SourceFetchModeEnum} mode
 *
 * @returns {IPageFetcher}
 */
function fetcherOf(mode: SourceFetchModeEnum): IPageFetcher {
  return { mode, fetch: () => Promise.reject(new Error('not called')) };
}

describe('PageFetcherRegistry', () => {
  it('finds the fetcher of each mode', () => {
    const html = fetcherOf(SourceFetchModeEnum.HTML);
    const rendered = fetcherOf(SourceFetchModeEnum.RENDERED);
    const registry = new PageFetcherRegistry([html, rendered]);

    expect(registry.findOne(SourceFetchModeEnum.HTML)).toBe(html);
    expect(registry.findOne(SourceFetchModeEnum.RENDERED)).toBe(rendered);
  });

  it('refuses two fetchers of one mode', () => {
    expect(() => new PageFetcherRegistry([fetcherOf(SourceFetchModeEnum.HTML), fetcherOf(SourceFetchModeEnum.HTML)])).toThrow(
      /^PAGE_FETCHER_DUPLICATE: html/
    );
  });

  it('names the supported modes for a mode nobody serves', () => {
    const registry = new PageFetcherRegistry([fetcherOf(SourceFetchModeEnum.HTML)]);

    expect(() => registry.findOne(SourceFetchModeEnum.RENDERED)).toThrow('PAGE_FETCH_MODE_UNSUPPORTED: "rendered" — supported: html');
  });
});
