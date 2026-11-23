import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { IEnv } from '../../../config/env.schema.js';
import { CrawlErrorCodeEnum } from '../enums/crawl-error-code.enum.js';
import { CrawlError } from '../errors/crawl.error.js';
import { HTMLPageFetcher } from '../fetchers/h-t-m-l-page.fetcher.js';
import { isPathAllowed, parseRobotsRules } from '../helpers/robots-rules.helper.js';
import type { IFetchedPage } from '../interfaces/fetched-page.interface.js';
import type { IRobotsRule } from '../interfaces/robots-rule.interface.js';
import { HostThrottleService } from './host-throttle.service.js';

/**
 * Rules of one site and when they stop being trusted
 */
interface IRobotsCacheEntry {
  /**
   * Rules of the `*` group
   *
   * @var {readonly IRobotsRule[]}
   */
  readonly rules: readonly IRobotsRule[];

  /**
   * Epoch ms after which robots.txt is read again
   *
   * @var {number}
   */
  readonly expiresAt: number;
}

/**
 * Lowest and highest status of a robots.txt that does not exist or is not for us — RFC 9309: everything is allowed
 *
 * @type {readonly [number, number]}
 */
const UNAVAILABLE_STATUSES: readonly [number, number] = [400, 499];

/**
 * Too many requests is not «no robots.txt» — the site is unreachable for now
 *
 * @type {number}
 */
const TOO_MANY_REQUESTS = 429;

/**
 * Reads and caches the robots.txt of every site before any page of it is fetched
 */
@Injectable()
export class RobotsService {
  /**
   * Logger
   *
   * @var {Logger}
   */
  private readonly logger = new Logger(RobotsService.name);

  /**
   * Rules per origin
   *
   * @var {Map<string, IRobotsCacheEntry>}
   */
  private readonly cache = new Map<string, IRobotsCacheEntry>();

  /**
   * @param {HTMLPageFetcher} htmlPageFetcher
   * @param {HostThrottleService} hostThrottleService
   * @param {ConfigService<IEnv, true>} configService
   */
  constructor(
    private readonly htmlPageFetcher: HTMLPageFetcher,
    private readonly hostThrottleService: HostThrottleService,
    private readonly configService: ConfigService<IEnv, true>
  ) {}

  /**
   * Whether the site's robots.txt lets the crawler fetch the URL
   *
   * @param {URL} url
   *
   * @throws {CrawlError} `FETCH_FAILED` if robots.txt is unreachable — nothing is fetched until it is read
   *
   * @returns {Promise<boolean>}
   */
  async isAllowed(url: URL): Promise<boolean> {
    const rules = await this.findRules(url);

    return isPathAllowed(rules, `${url.pathname}${url.search}`);
  }

  /**
   * Rules of the site, from the cache or read now
   *
   * @param {URL} url
   *
   * @throws {CrawlError} `FETCH_FAILED` if robots.txt is unreachable
   *
   * @returns {Promise<readonly IRobotsRule[]>}
   */
  private async findRules(url: URL): Promise<readonly IRobotsRule[]> {
    const cached = this.cache.get(url.origin);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.rules;
    }

    const rules = await this.read(url);

    this.cache.set(url.origin, { rules, expiresAt: Date.now() + this.configService.get('ROBOTS_CACHE_TTL_MS', { infer: true }) });

    return rules;
  }

  /**
   * Request robots.txt through the host queue: 2xx — its rules; 4xx except 429 — none, everything allowed;
   * anything else — unreachable. An unreachable answer is not cached, the next fetch asks again
   *
   * @param {URL} url
   *
   * @throws {CrawlError} `FETCH_FAILED` on a network failure, 429 or 5xx; `PRIVATE_ADDRESS` from the fetcher
   *
   * @returns {Promise<readonly IRobotsRule[]>}
   */
  private async read(url: URL): Promise<readonly IRobotsRule[]> {
    const robotsURL = new URL('/robots.txt', url.origin);
    let page: IFetchedPage;

    try {
      page = await this.hostThrottleService.run(url.host, async () => this.htmlPageFetcher.fetch(robotsURL));
    } catch (error) {
      if (error instanceof CrawlError) {
        throw error;
      }

      throw new CrawlError(CrawlErrorCodeEnum.FETCH_FAILED, `robots.txt of ${url.host} unreachable: ${(error as Error).message}`, {
        cause: error
      });
    }

    if (page.status >= 200 && page.status < 300) {
      const rules = parseRobotsRules(page.html);

      this.logger.debug({ message: 'robots.txt read', host: url.host, rules: rules.length });

      return rules;
    }

    const [lowest, highest] = UNAVAILABLE_STATUSES;

    if (page.status >= lowest && page.status <= highest && page.status !== TOO_MANY_REQUESTS) {
      this.logger.debug({ message: 'robots.txt absent', host: url.host, status: page.status });

      return [];
    }

    throw new CrawlError(CrawlErrorCodeEnum.FETCH_FAILED, `robots.txt of ${url.host} answered HTTP ${page.status}`);
  }
}
