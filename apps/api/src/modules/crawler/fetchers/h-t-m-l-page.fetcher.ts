import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { SourceFetchModeEnum } from '@job-agent/shared';

import type { IEnv } from '../../../config/env.schema.js';
import { CrawlErrorCodeEnum } from '../enums/crawl-error-code.enum.js';
import { CrawlError } from '../errors/crawl.error.js';
import type { IFetchedPage } from '../interfaces/fetched-page.interface.js';
import type { IPageFetcher } from '../interfaces/page-fetcher.interface.js';
import { AddressGuardService } from '../services/address-guard.service.js';

/**
 * What a desktop browser asks for when it opens a page
 *
 * @type {string}
 */
const ACCEPT = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';

/**
 * The working language of the search
 *
 * @type {string}
 */
const ACCEPT_LANGUAGE = 'en-US,en;q=0.9';

/**
 * Statuses of a redirect that carries a `Location`
 *
 * @type {ReadonlySet<number>}
 */
const REDIRECT_STATUSES: ReadonlySet<number> = new Set([301, 302, 303, 307, 308]);

/**
 * Most redirects followed for one page, as browsers allow
 *
 * @type {number}
 */
const MAX_REDIRECTS = 10;

/**
 * Protocols a redirect may lead to
 *
 * @type {ReadonlySet<string>}
 */
const WEB_PROTOCOLS: ReadonlySet<string> = new Set(['http:', 'https:']);

/**
 * Loads a page with one plain request — for lists already present in the HTML; also reads robots.txt
 */
@Injectable()
export class HTMLPageFetcher implements IPageFetcher {
  /**
   * The mode it serves
   *
   * @var {SourceFetchModeEnum}
   */
  readonly mode = SourceFetchModeEnum.HTML;

  /**
   * @param {AddressGuardService} addressGuardService
   * @param {ConfigService<IEnv, true>} configService
   */
  constructor(
    private readonly addressGuardService: AddressGuardService,
    private readonly configService: ConfigService<IEnv, true>
  ) {}

  /**
   * Request the page within `HTTP_TIMEOUT_MS`, following redirects one by one — each hop is checked for a private
   * address before it is requested
   *
   * @param {URL} url
   *
   * @throws {CrawlError} `PRIVATE_ADDRESS` if a hop resolves to a private address
   * @throws {CrawlError} `INVALID_URL` if a redirect leads to anything but http(s)
   * @throws {Error} On a network failure, the timeout or too many redirects
   *
   * @returns {Promise<IFetchedPage>}
   */
  async fetch(url: URL): Promise<IFetchedPage> {
    const signal = AbortSignal.timeout(this.configService.get('HTTP_TIMEOUT_MS', { infer: true }));
    let current = url;

    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      await this.addressGuardService.assertPublic(current);

      const response = await this.request(current, signal);
      const location = response.headers.get('location');

      if (!REDIRECT_STATUSES.has(response.status) || !location) {
        return {
          url: current.href,
          status: response.status,
          headers: Object.fromEntries(response.headers),
          html: await response.text()
        };
      }

      await response.body?.cancel();
      current = this.redirectTarget(location, current);
    }

    throw new Error(`${url.host}: more than ${MAX_REDIRECTS} redirects`);
  }

  /**
   * One request, redirects not followed
   *
   * @param {URL} url
   * @param {AbortSignal} signal
   *
   * @returns {Promise<Response>}
   */
  private async request(url: URL, signal: AbortSignal): Promise<Response> {
    return fetch(url, {
      headers: {
        'user-agent': this.configService.get('HTTP_USER_AGENT', { infer: true }),
        accept: ACCEPT,
        'accept-language': ACCEPT_LANGUAGE
      },
      redirect: 'manual',
      signal
    });
  }

  /**
   * Where a redirect leads
   *
   * @param {string} location
   * @param {URL} from
   *
   * @throws {CrawlError} `INVALID_URL` if it is not an http(s) URL
   *
   * @returns {URL}
   */
  private redirectTarget(location: string, from: URL): URL {
    const target = URL.parse(location, from.href);

    if (!target || !WEB_PROTOCOLS.has(target.protocol)) {
      throw new CrawlError(CrawlErrorCodeEnum.INVALID_URL, `${from.host} redirects to ${location}`);
    }

    return target;
  }
}
