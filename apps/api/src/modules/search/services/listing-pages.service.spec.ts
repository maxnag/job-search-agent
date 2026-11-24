import { type DeepMocked, createMock } from '@golevelup/ts-vitest';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SourceFetchModeEnum } from '@job-agent/shared';

import { createConfigMock } from '../../../../test/config-service.mock.js';
import { CrawlErrorCodeEnum } from '../../crawler/enums/crawl-error-code.enum.js';
import { CrawlError } from '../../crawler/errors/crawl.error.js';
import type { IFetchedPage } from '../../crawler/interfaces/fetched-page.interface.js';
import { CrawlerService } from '../../crawler/services/crawler.service.js';
import { ListingGapEnum } from '../enums/listing-gap.enum.js';
import { ListingPagesService } from './listing-pages.service.js';

const LIST = 'https://careers.example.com/jobs';

const NAV = '<nav><a href="/about">About</a></nav>';

/**
 * A page of the list: the navigation, one posting and what follows it
 *
 * @param {number} number
 * @param {string} [more] Pagination of the page
 * @param {Partial<IFetchedPage>} [changes]
 *
 * @returns {IFetchedPage}
 */
function listPage(number: number, more = '', changes: Partial<IFetchedPage> = {}): IFetchedPage {
  return {
    url: number === 1 ? LIST : `${LIST}?page=${number}`,
    status: 200,
    headers: {},
    html: `${NAV}<a href="/jobs/${number}">Position ${number}</a>${more}`,
    ...changes
  };
}

/**
 * A link to the next page
 *
 * @param {number} number
 *
 * @returns {string}
 */
function next(number: number): string {
  return `<a rel="next" href="/jobs?page=${number}">Next</a>`;
}

describe('ListingPagesService (unit)', () => {
  let moduleFixture: TestingModule;
  let subjectUnderTest: ListingPagesService;
  let crawler: DeepMocked<CrawlerService>;

  /**
   * Build the service with these limits
   *
   * @param {number} maxPages
   * @param {number} maxLinks
   *
   * @returns {Promise<void>}
   */
  async function build(maxPages = 10, maxLinks = 100): Promise<void> {
    moduleFixture = await Test.createTestingModule({
      providers: [
        ListingPagesService,
        { provide: CrawlerService, useValue: crawler },
        { provide: ConfigService, useValue: createConfigMock({ LISTING_MAX_PAGES: maxPages, LISTING_MAX_LINKS: maxLinks }) }
      ]
    }).compile();

    subjectUnderTest = moduleFixture.get(ListingPagesService);
  }

  /**
   * Answer each address with its page, or reject it with its error
   *
   * @param {Record<string, IFetchedPage | Error>} answers
   *
   * @returns {void}
   */
  function serve(answers: Record<string, IFetchedPage | Error>): void {
    crawler.fetchPage.mockImplementation(url => {
      const answer = answers[url] ?? new Error(`unexpected fetch of ${url}`);

      return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
    });
  }

  beforeEach(async () => {
    crawler = createMock<CrawlerService>();
    await build();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await moduleFixture.close();
  });

  it('should be defined', () => {
    expect(subjectUnderTest).toBeDefined();
  });

  it('reads one page of a list without pagination', async () => {
    serve({ [LIST]: listPage(1) });

    const listing = await subjectUnderTest.read(LIST, SourceFetchModeEnum.HTML);

    expect({ ...listing, candidates: listing.candidates.map(candidate => candidate.url) }).toEqual({
      url: LIST,
      pages: 1,
      candidates: ['https://careers.example.com/about', 'https://careers.example.com/jobs/1'],
      gaps: []
    });
    expect(crawler.fetchPage).toHaveBeenCalledWith(LIST, SourceFetchModeEnum.HTML);
  });

  it('follows the pages to the end in the mode of the source, the links of all of them as one list', async () => {
    serve({
      [LIST]: listPage(1, next(2)),
      [`${LIST}?page=2`]: listPage(2, next(3)),
      [`${LIST}?page=3`]: listPage(3)
    });

    const listing = await subjectUnderTest.read(LIST, SourceFetchModeEnum.RENDERED);

    expect(listing.pages).toBe(3);
    expect(listing.gaps).toEqual([]);
    expect(listing.candidates.map(candidate => candidate.url)).toEqual([
      'https://careers.example.com/about',
      'https://careers.example.com/jobs/1',
      `${LIST}?page=2`,
      'https://careers.example.com/jobs/2',
      `${LIST}?page=3`,
      'https://careers.example.com/jobs/3'
    ]);
    expect(crawler.fetchPage).toHaveBeenLastCalledWith(`${LIST}?page=3`, SourceFetchModeEnum.RENDERED);
  });

  it('names the listing by the address the first page landed on', async () => {
    serve({ [`${LIST}/`]: listPage(1) });

    await expect(subjectUnderTest.read(`${LIST}/`, SourceFetchModeEnum.HTML)).resolves.toMatchObject({ url: LIST });
  });

  describe('where the list ends', () => {
    it('ends where the next page loops back to a page read, without a gap', async () => {
      serve({
        [LIST]: listPage(1, next(2)),
        [`${LIST}?page=2`]: listPage(2, `<a rel="next" href="/jobs#top">Next</a>`)
      });

      await expect(subjectUnderTest.read(LIST, SourceFetchModeEnum.HTML)).resolves.toMatchObject({ pages: 2, gaps: [] });
      expect(crawler.fetchPage).toHaveBeenCalledTimes(2);
    });

    it('ends where the next page is sent back to a page read, without a gap and without its links', async () => {
      serve({
        [LIST]: listPage(1, next(2)),
        [`${LIST}?page=2`]: listPage(1, next(2))
      });

      await expect(subjectUnderTest.read(LIST, SourceFetchModeEnum.HTML)).resolves.toMatchObject({ pages: 1, gaps: [] });
    });
  });

  describe('where the list is left incomplete', () => {
    it('stops at LISTING_MAX_PAGES with a pagination gap', async () => {
      await build(2);
      serve({
        [LIST]: listPage(1, next(2)),
        [`${LIST}?page=2`]: listPage(2, next(3))
      });

      await expect(subjectUnderTest.read(LIST, SourceFetchModeEnum.HTML)).resolves.toMatchObject({
        pages: 2,
        gaps: [ListingGapEnum.PAGINATION]
      });
      expect(crawler.fetchPage).toHaveBeenCalledTimes(2);
    });

    it('stops at a sign of pagination without an address', async () => {
      serve({ [LIST]: listPage(1, '<button>Load more</button>') });

      await expect(subjectUnderTest.read(LIST, SourceFetchModeEnum.HTML)).resolves.toMatchObject({
        pages: 1,
        gaps: [ListingGapEnum.PAGINATION]
      });
    });

    it('loads no next page once the links fill LISTING_MAX_LINKS', async () => {
      await build(10, 3);
      serve({ [LIST]: listPage(1, next(2)) });

      await expect(subjectUnderTest.read(LIST, SourceFetchModeEnum.HTML)).resolves.toMatchObject({
        pages: 1,
        gaps: [ListingGapEnum.LINK_LIMIT]
      });
      expect(crawler.fetchPage).toHaveBeenCalledTimes(1);
    });

    it('reports a page whose scrolling stopped early', async () => {
      serve({
        [LIST]: listPage(1, next(2)),
        [`${LIST}?page=2`]: listPage(2, '', { partial: true })
      });

      await expect(subjectUnderTest.read(LIST, SourceFetchModeEnum.RENDERED)).resolves.toMatchObject({
        pages: 2,
        gaps: [ListingGapEnum.SCROLL_LIMIT]
      });
    });

    it.each([
      CrawlErrorCodeEnum.ROBOTS_DISALLOWED,
      CrawlErrorCodeEnum.FETCH_FAILED,
      CrawlErrorCodeEnum.FETCH_HTTP_ERROR,
      CrawlErrorCodeEnum.PRIVATE_ADDRESS,
      CrawlErrorCodeEnum.INVALID_URL
    ])('keeps what was read and leaves a gap when a later page fails with %s', async code => {
      const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

      serve({ [LIST]: listPage(1, next(2)), [`${LIST}?page=2`]: new CrawlError(code, 'careers.example.com/jobs') });

      await expect(subjectUnderTest.read(LIST, SourceFetchModeEnum.HTML)).resolves.toMatchObject({
        pages: 1,
        gaps: [ListingGapEnum.PAGINATION]
      });
      expect(warn).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Listing page not read, the listing is incomplete', url: `${LIST}?page=2`, code })
      );
    });
  });

  describe('a refusal', () => {
    it('passes SOURCE_BLOCKED of a later page on — the site refused the crawler', async () => {
      const blocked = new CrawlError(CrawlErrorCodeEnum.SOURCE_BLOCKED, 'careers.example.com: 403');

      serve({ [LIST]: listPage(1, next(2)), [`${LIST}?page=2`]: blocked });

      await expect(subjectUnderTest.read(LIST, SourceFetchModeEnum.HTML)).rejects.toBe(blocked);
    });

    it('passes an error of a later page that is not a crawl failure on', async () => {
      serve({ [LIST]: listPage(1, next(2)), [`${LIST}?page=2`]: new TypeError('bug') });

      await expect(subjectUnderTest.read(LIST, SourceFetchModeEnum.HTML)).rejects.toThrow('bug');
    });

    it('passes any refusal of the first page on', async () => {
      const forbidden = new CrawlError(CrawlErrorCodeEnum.ROBOTS_DISALLOWED, 'careers.example.com/jobs');

      serve({ [LIST]: forbidden });

      await expect(subjectUnderTest.read(LIST, SourceFetchModeEnum.HTML)).rejects.toBe(forbidden);
    });
  });
});
