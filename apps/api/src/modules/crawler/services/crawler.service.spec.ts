import { type DeepMocked, createMock } from '@golevelup/ts-vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SourceFetchModeEnum } from '@job-agent/shared';

import { CrawlErrorCodeEnum } from '../enums/crawl-error-code.enum.js';
import { CrawlPaceEnum } from '../enums/crawl-pace.enum.js';
import { CrawlError } from '../errors/crawl.error.js';
import type { IFetchedPage } from '../interfaces/fetched-page.interface.js';
import type { IPageFetcher } from '../interfaces/page-fetcher.interface.js';
import { AddressGuardService } from './address-guard.service.js';
import { CrawlerService } from './crawler.service.js';
import { HostThrottleService } from './host-throttle.service.js';
import { PageFetcherRegistry } from './page-fetcher.registry.js';
import { RobotsService } from './robots.service.js';

const URL_JOBS = 'https://careers.example.com/jobs';

/**
 * A page the site served
 *
 * @param {Partial<IFetchedPage>} changes
 *
 * @returns {IFetchedPage}
 */
function served(changes: Partial<IFetchedPage> = {}): IFetchedPage {
  return { url: URL_JOBS, status: 200, headers: {}, html: '<a href="/jobs/1">Developer</a>', ...changes };
}

describe('CrawlerService (unit)', () => {
  let moduleFixture: TestingModule;
  let subjectUnderTest: CrawlerService;
  let guard: DeepMocked<AddressGuardService>;
  let robots: DeepMocked<RobotsService>;
  let throttle: DeepMocked<HostThrottleService>;
  let fetcher: DeepMocked<IPageFetcher>;

  beforeEach(async () => {
    guard = createMock<AddressGuardService>();
    robots = createMock<RobotsService>();
    throttle = createMock<HostThrottleService>();
    fetcher = createMock<IPageFetcher>({ mode: SourceFetchModeEnum.HTML });
    guard.assertPublic.mockResolvedValue();
    robots.isAllowed.mockResolvedValue(true);
    throttle.run.mockImplementation(async (_host, request) => request());
    fetcher.fetch.mockResolvedValue(served());
    moduleFixture = await Test.createTestingModule({
      providers: [
        CrawlerService,
        { provide: AddressGuardService, useValue: guard },
        { provide: RobotsService, useValue: robots },
        { provide: HostThrottleService, useValue: throttle },
        { provide: PageFetcherRegistry, useValue: new PageFetcherRegistry([fetcher]) }
      ]
    }).compile();

    subjectUnderTest = moduleFixture.get(CrawlerService);
  });

  afterEach(async () => {
    await moduleFixture.close();
  });

  it('should be defined', () => {
    expect(subjectUnderTest).toBeDefined();
  });

  it('checks the address, then robots.txt, then fetches through the host queue', async () => {
    const order: string[] = [];

    guard.assertPublic.mockImplementation(() => {
      order.push('guard');

      return Promise.resolve();
    });
    robots.isAllowed.mockImplementation(() => {
      order.push('robots');

      return Promise.resolve(true);
    });
    throttle.run.mockImplementation(async (host, request) => {
      order.push(`fetch ${host}`);

      return request();
    });

    await expect(subjectUnderTest.fetchPage(URL_JOBS, SourceFetchModeEnum.HTML)).resolves.toEqual(served());
    expect(order).toEqual(['guard', 'robots', 'fetch careers.example.com']);
  });

  it.each(['ftp://careers.example.com/jobs', 'not a url', 'javascript:alert(1)'])('refuses %j as an invalid URL', async url => {
    await expect(subjectUnderTest.fetchPage(url, SourceFetchModeEnum.HTML)).rejects.toMatchObject({ code: CrawlErrorCodeEnum.INVALID_URL });
    expect(guard.assertPublic).not.toHaveBeenCalled();
  });

  it('makes no request, not even for robots.txt, to a private address', async () => {
    guard.assertPublic.mockRejectedValue(new CrawlError(CrawlErrorCodeEnum.PRIVATE_ADDRESS, 'careers.example.com resolves to 10.0.0.1'));

    await expect(subjectUnderTest.fetchPage(URL_JOBS, SourceFetchModeEnum.HTML)).rejects.toMatchObject({
      code: CrawlErrorCodeEnum.PRIVATE_ADDRESS
    });
    expect(robots.isAllowed).not.toHaveBeenCalled();
    expect(fetcher.fetch).not.toHaveBeenCalled();
  });

  it('does not fetch a path robots.txt forbids', async () => {
    robots.isAllowed.mockResolvedValue(false);

    await expect(subjectUnderTest.fetchPage(URL_JOBS, SourceFetchModeEnum.HTML)).rejects.toMatchObject({
      code: CrawlErrorCodeEnum.ROBOTS_DISALLOWED,
      message: 'ROBOTS_DISALLOWED: careers.example.com/jobs'
    });
    expect(fetcher.fetch).not.toHaveBeenCalled();
  });

  it('turns a fetcher error into a retryable failure with the first line of its message', async () => {
    fetcher.fetch.mockRejectedValue(new Error('page.goto: Timeout 30000ms exceeded.\nCall log:\n  - navigating'));

    await expect(subjectUnderTest.fetchPage(URL_JOBS, SourceFetchModeEnum.HTML)).rejects.toMatchObject({
      code: CrawlErrorCodeEnum.FETCH_FAILED,
      message: 'FETCH_FAILED: careers.example.com (html): page.goto: Timeout 30000ms exceeded.'
    });
  });

  it('passes a refusal of the fetcher on unchanged', async () => {
    const refusal = new CrawlError(CrawlErrorCodeEnum.PRIVATE_ADDRESS, 'redirect to 127.0.0.1');

    fetcher.fetch.mockRejectedValue(refusal);

    await expect(subjectUnderTest.fetchPage(URL_JOBS, SourceFetchModeEnum.HTML)).rejects.toBe(refusal);
  });

  it('passes the time limit to the fetcher and the pace to the host queue', async () => {
    await subjectUnderTest.fetchPage(URL_JOBS, SourceFetchModeEnum.HTML, { timeoutMs: 4000, pace: CrawlPaceEnum.API });

    expect(throttle.run).toHaveBeenCalledWith('careers.example.com', expect.any(Function), CrawlPaceEnum.API);
    expect(fetcher.fetch).toHaveBeenCalledWith(new URL(URL_JOBS), 4000);
  });

  it('leaves the pace and the time limit to their defaults without options', async () => {
    await subjectUnderTest.fetchPage(URL_JOBS, SourceFetchModeEnum.HTML);

    expect(throttle.run).toHaveBeenCalledWith('careers.example.com', expect.any(Function), undefined);
    expect(fetcher.fetch).toHaveBeenCalledWith(new URL(URL_JOBS), undefined);
  });

  it('checks the address and robots.txt of the site a redirect landed on', async () => {
    fetcher.fetch.mockResolvedValue(served({ url: 'https://jobs.board.example/company/1' }));

    await subjectUnderTest.fetchPage(URL_JOBS, SourceFetchModeEnum.HTML);

    expect(guard.assertPublic).toHaveBeenLastCalledWith(new URL('https://jobs.board.example/company/1'));
    expect(robots.isAllowed).toHaveBeenLastCalledWith(new URL('https://jobs.board.example/company/1'));
  });

  it('refuses a redirect to a path the other site forbids', async () => {
    fetcher.fetch.mockResolvedValue(served({ url: 'https://jobs.board.example/private' }));
    robots.isAllowed.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    await expect(subjectUnderTest.fetchPage(URL_JOBS, SourceFetchModeEnum.HTML)).rejects.toMatchObject({
      code: CrawlErrorCodeEnum.ROBOTS_DISALLOWED
    });
  });

  it('does not check robots.txt again after a redirect within the site', async () => {
    fetcher.fetch.mockResolvedValue(served({ url: 'https://careers.example.com/jobs/' }));

    await subjectUnderTest.fetchPage(URL_JOBS, SourceFetchModeEnum.HTML);

    expect(robots.isAllowed).toHaveBeenCalledTimes(1);
    expect(guard.assertPublic).toHaveBeenCalledTimes(1);
  });

  it('reports a site that refused the crawler', async () => {
    fetcher.fetch.mockResolvedValue(served({ status: 403 }));

    await expect(subjectUnderTest.fetchPage(URL_JOBS, SourceFetchModeEnum.HTML)).rejects.toMatchObject({
      code: CrawlErrorCodeEnum.SOURCE_BLOCKED,
      message: 'SOURCE_BLOCKED: careers.example.com: HTTP 403'
    });
  });

  it.each([500, 503, 408])('fails retryably on HTTP %i', async status => {
    fetcher.fetch.mockResolvedValue(served({ status }));

    await expect(subjectUnderTest.fetchPage(URL_JOBS, SourceFetchModeEnum.HTML)).rejects.toMatchObject({
      code: CrawlErrorCodeEnum.FETCH_FAILED
    });
  });

  it.each([404, 410, 400])('fails for good on HTTP %i', async status => {
    fetcher.fetch.mockResolvedValue(served({ status }));

    await expect(subjectUnderTest.fetchPage(URL_JOBS, SourceFetchModeEnum.HTML)).rejects.toMatchObject({
      code: CrawlErrorCodeEnum.FETCH_HTTP_ERROR,
      message: `FETCH_HTTP_ERROR: careers.example.com/jobs: HTTP ${status}`
    });
  });

  it('returns a page with a status below 400 that is not a refusal', async () => {
    fetcher.fetch.mockResolvedValue(served({ status: 399 }));

    await expect(subjectUnderTest.fetchPage(URL_JOBS, SourceFetchModeEnum.HTML)).resolves.toMatchObject({ status: 399 });
  });
});
