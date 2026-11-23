import { type DeepMocked, createMock } from '@golevelup/ts-vitest';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createConfigMock } from '../../../../test/config-service.mock.js';
import { CrawlErrorCodeEnum } from '../enums/crawl-error-code.enum.js';
import { CrawlError } from '../errors/crawl.error.js';
import { HTMLPageFetcher } from '../fetchers/h-t-m-l-page.fetcher.js';
import type { IFetchedPage } from '../interfaces/fetched-page.interface.js';
import { HostThrottleService } from './host-throttle.service.js';
import { RobotsService } from './robots.service.js';

const JOBS = new URL('https://careers.example.com/jobs/1?ref=list');

/**
 * The robots.txt answer of the site
 *
 * @param {number} status
 * @param {string} html
 *
 * @returns {IFetchedPage}
 */
function robots(status: number, html = ''): IFetchedPage {
  return { url: 'https://careers.example.com/robots.txt', status, headers: {}, html };
}

describe('RobotsService (unit)', () => {
  let moduleFixture: TestingModule;
  let subjectUnderTest: RobotsService;
  let fetcher: DeepMocked<HTMLPageFetcher>;
  let throttle: DeepMocked<HostThrottleService>;

  /**
   * Build the service with a cache lifetime
   *
   * @param {number} ttlMs
   *
   * @returns {Promise<void>}
   */
  async function compile(ttlMs: number): Promise<void> {
    moduleFixture = await Test.createTestingModule({
      providers: [
        RobotsService,
        { provide: HTMLPageFetcher, useValue: fetcher },
        { provide: HostThrottleService, useValue: throttle },
        { provide: ConfigService, useValue: createConfigMock({ ROBOTS_CACHE_TTL_MS: ttlMs }) }
      ]
    }).compile();
    subjectUnderTest = moduleFixture.get(RobotsService);
  }

  beforeEach(async () => {
    fetcher = createMock<HTMLPageFetcher>();
    throttle = createMock<HostThrottleService>();
    throttle.run.mockImplementation(async (_host, request) => request());
    await compile(60_000);
  });

  afterEach(async () => {
    await moduleFixture.close();
  });

  it('should be defined', () => {
    expect(subjectUnderTest).toBeDefined();
  });

  it('reads robots.txt of the origin through the host queue and checks path and query', async () => {
    fetcher.fetch.mockResolvedValue(robots(200, 'User-agent: *\nDisallow: /jobs/1?ref='));

    await expect(subjectUnderTest.isAllowed(JOBS)).resolves.toBe(false);
    expect(throttle.run).toHaveBeenCalledWith('careers.example.com', expect.any(Function));
    expect(fetcher.fetch).toHaveBeenCalledWith(new URL('https://careers.example.com/robots.txt'));
  });

  it('allows a path the rules leave alone', async () => {
    fetcher.fetch.mockResolvedValue(robots(200, 'User-agent: *\nDisallow: /admin'));

    await expect(subjectUnderTest.isAllowed(JOBS)).resolves.toBe(true);
  });

  it('reads robots.txt of an origin once while the cache lives', async () => {
    fetcher.fetch.mockResolvedValue(robots(200, ''));

    await subjectUnderTest.isAllowed(JOBS);
    await subjectUnderTest.isAllowed(new URL('https://careers.example.com/other'));

    expect(fetcher.fetch).toHaveBeenCalledTimes(1);
  });

  it('reads robots.txt again once the cache expired', async () => {
    await moduleFixture.close();
    await compile(0);
    fetcher.fetch.mockResolvedValue(robots(200, ''));

    await subjectUnderTest.isAllowed(JOBS);
    await subjectUnderTest.isAllowed(JOBS);

    expect(fetcher.fetch).toHaveBeenCalledTimes(2);
  });

  it.each([400, 401, 403, 404, 410, 499])('allows everything when robots.txt answers %i', async status => {
    fetcher.fetch.mockResolvedValue(robots(status, 'User-agent: *\nDisallow: /'));

    await expect(subjectUnderTest.isAllowed(JOBS)).resolves.toBe(true);
  });

  it.each([429, 500, 503, 302])('fails retryably when robots.txt answers %i, and does not cache it', async status => {
    fetcher.fetch.mockResolvedValue(robots(status));

    await expect(subjectUnderTest.isAllowed(JOBS)).rejects.toMatchObject({ code: CrawlErrorCodeEnum.FETCH_FAILED });
    await expect(subjectUnderTest.isAllowed(JOBS)).rejects.toBeInstanceOf(CrawlError);
    expect(fetcher.fetch).toHaveBeenCalledTimes(2);
  });

  it('fails retryably on a network error, keeping it as the cause', async () => {
    const cause = new Error('ECONNRESET');

    fetcher.fetch.mockRejectedValue(cause);

    await expect(subjectUnderTest.isAllowed(JOBS)).rejects.toMatchObject({
      code: CrawlErrorCodeEnum.FETCH_FAILED,
      message: 'FETCH_FAILED: robots.txt of careers.example.com unreachable: ECONNRESET',
      cause
    });
  });

  it('passes a refusal of the fetcher on unchanged', async () => {
    const refusal = new CrawlError(CrawlErrorCodeEnum.PRIVATE_ADDRESS, 'careers.example.com resolves to 10.0.0.1');

    fetcher.fetch.mockRejectedValue(refusal);

    await expect(subjectUnderTest.isAllowed(JOBS)).rejects.toBe(refusal);
  });
});
