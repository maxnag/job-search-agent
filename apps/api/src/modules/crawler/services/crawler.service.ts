import { Injectable, Logger } from '@nestjs/common';

import type { SourceFetchModeEnum } from '@job-agent/shared';

import { CrawlErrorCodeEnum } from '../enums/crawl-error-code.enum.js';
import { CrawlError } from '../errors/crawl.error.js';
import { detectBlock } from '../helpers/block-detection.helper.js';
import type { IFetchedPage } from '../interfaces/fetched-page.interface.js';
import { AddressGuardService } from './address-guard.service.js';
import { HostThrottleService } from './host-throttle.service.js';
import { PageFetcherRegistry } from './page-fetcher.registry.js';
import { RobotsService } from './robots.service.js';

/**
 * Protocols the crawler follows
 *
 * @type {ReadonlySet<string>}
 */
const WEB_PROTOCOLS: ReadonlySet<string> = new Set(['http:', 'https:']);

/**
 * Request Timeout — the site may answer on a later attempt
 *
 * @type {number}
 */
const REQUEST_TIMEOUT = 408;

/**
 * Lowest server-error status
 *
 * @type {number}
 */
const SERVER_ERROR = 500;

/**
 * Lowest client-error status
 *
 * @type {number}
 */
const CLIENT_ERROR = 400;

/**
 * First line of an error message — a browser error goes on with a call log and terminal colours
 *
 * @param {string} message
 *
 * @returns {string}
 */
function firstLine(message: string): string {
  return message.split('\n', 1)[0]?.trim() ?? '';
}

/**
 * The polite way to fetch any page: robots.txt first, one request at a time per site with a random pause, the
 * site's refusal recognized and reported — for every fetch mode alike
 */
@Injectable()
export class CrawlerService {
  /**
   * Logger
   *
   * @var {Logger}
   */
  private readonly logger = new Logger(CrawlerService.name);

  /**
   * @param {AddressGuardService} addressGuardService
   * @param {RobotsService} robotsService
   * @param {HostThrottleService} hostThrottleService
   * @param {PageFetcherRegistry} pageFetcherRegistry
   */
  constructor(
    private readonly addressGuardService: AddressGuardService,
    private readonly robotsService: RobotsService,
    private readonly hostThrottleService: HostThrottleService,
    private readonly pageFetcherRegistry: PageFetcherRegistry
  ) {}

  /**
   * Fetch a page in the given mode; a redirect to another site is checked against that site's robots.txt too, and
   * no request goes to a private address — neither the page, nor a redirect, nor robots.txt
   *
   * @param {string} url
   * @param {SourceFetchModeEnum} mode
   *
   * @throws {CrawlError} `INVALID_URL` — not an http(s) URL
   * @throws {CrawlError} `PRIVATE_ADDRESS` — the host or a redirect resolves to a private address
   * @throws {CrawlError} `ROBOTS_DISALLOWED` — robots.txt forbids the path, no request was made to it
   * @throws {CrawlError} `SOURCE_BLOCKED` — 403, 429 or a challenge page
   * @throws {CrawlError} `FETCH_FAILED` — timeout, network, 5xx, 408 or unreachable robots.txt; retried
   * @throws {CrawlError} `FETCH_HTTP_ERROR` — any other 4xx, such as a vacancy that is gone
   *
   * @returns {Promise<IFetchedPage>}
   */
  async fetchPage(url: string, mode: SourceFetchModeEnum): Promise<IFetchedPage> {
    const target = this.parseURL(url);

    await this.addressGuardService.assertPublic(target);
    await this.assertAllowed(target);

    const fetcher = this.pageFetcherRegistry.findOne(mode);
    let page: IFetchedPage;

    try {
      page = await this.hostThrottleService.run(target.host, async () => fetcher.fetch(target));
    } catch (error) {
      if (error instanceof CrawlError) {
        throw error;
      }

      throw new CrawlError(CrawlErrorCodeEnum.FETCH_FAILED, `${target.host} (${mode}): ${firstLine((error as Error).message)}`, {
        cause: error
      });
    }

    const landed = new URL(page.url);

    if (landed.host !== target.host) {
      await this.addressGuardService.assertPublic(landed);
      await this.assertAllowed(landed);
    }

    this.assertServed(page, landed, mode);
    this.logger.debug({ message: 'Page fetched', host: landed.host, mode, status: page.status, length: page.html.length });

    return page;
  }

  /**
   * An http(s) URL
   *
   * @param {string} url
   *
   * @throws {CrawlError} `INVALID_URL`
   *
   * @returns {URL}
   */
  private parseURL(url: string): URL {
    const parsed = URL.parse(url);

    if (!parsed || !WEB_PROTOCOLS.has(parsed.protocol)) {
      throw new CrawlError(CrawlErrorCodeEnum.INVALID_URL, url);
    }

    return parsed;
  }

  /**
   * Refuse a URL the site's robots.txt forbids
   *
   * @param {URL} url
   *
   * @throws {CrawlError} `ROBOTS_DISALLOWED`, or `FETCH_FAILED` if robots.txt is unreachable
   *
   * @returns {Promise<void>}
   */
  private async assertAllowed(url: URL): Promise<void> {
    if (await this.robotsService.isAllowed(url)) {
      return;
    }

    this.logger.warn({ message: 'Path disallowed by robots.txt', host: url.host, path: url.pathname });

    throw new CrawlError(CrawlErrorCodeEnum.ROBOTS_DISALLOWED, `${url.host}${url.pathname}`);
  }

  /**
   * Refuse a page the site did not really serve
   *
   * @param {IFetchedPage} page
   * @param {URL} url
   * @param {SourceFetchModeEnum} mode
   *
   * @throws {CrawlError} `SOURCE_BLOCKED`, `FETCH_FAILED` or `FETCH_HTTP_ERROR`
   *
   * @returns {void}
   */
  private assertServed(page: IFetchedPage, url: URL, mode: SourceFetchModeEnum): void {
    const block = detectBlock(page);

    if (block) {
      this.logger.warn({ message: 'Site refused the crawler', host: url.host, mode, reason: block });

      throw new CrawlError(CrawlErrorCodeEnum.SOURCE_BLOCKED, `${url.host}: ${block}`);
    }

    if (page.status >= SERVER_ERROR || page.status === REQUEST_TIMEOUT) {
      throw new CrawlError(CrawlErrorCodeEnum.FETCH_FAILED, `${url.host}: HTTP ${page.status}`);
    }

    if (page.status >= CLIENT_ERROR) {
      throw new CrawlError(CrawlErrorCodeEnum.FETCH_HTTP_ERROR, `${url.host}${url.pathname}: HTTP ${page.status}`);
    }
  }
}
