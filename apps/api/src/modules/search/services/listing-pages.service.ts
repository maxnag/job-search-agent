import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { SourceFetchModeEnum } from '@job-agent/shared';

import type { IEnv } from '../../../config/env.schema.js';
import { CrawlErrorCodeEnum } from '../../crawler/enums/crawl-error-code.enum.js';
import { CrawlError } from '../../crawler/errors/crawl.error.js';
import type { IFetchedPage } from '../../crawler/interfaces/fetched-page.interface.js';
import { CrawlerService } from '../../crawler/services/crawler.service.js';
import { ListingGapEnum } from '../enums/listing-gap.enum.js';
import { extractLinkCandidates, mergeLinkCandidates } from '../helpers/listing-page.helper.js';
import { findPagination } from '../helpers/listing-pagination.helper.js';
import type { ILinkCandidates } from '../interfaces/link-candidates.interface.js';
import type { IListingLinks } from '../interfaces/listing-links.interface.js';

/**
 * Gaps of a listing, in a fixed order
 *
 * @param {boolean} paginated The list goes on past the pages read
 * @param {boolean} truncated The link limit cut the list short
 * @param {boolean} partial The scrolling of a page stopped while links were still growing
 *
 * @returns {ListingGapEnum[]}
 */
function listingGaps(paginated: boolean, truncated: boolean, partial: boolean): ListingGapEnum[] {
  const gaps: ListingGapEnum[] = [];

  if (paginated) {
    gaps.push(ListingGapEnum.PAGINATION);
  }

  if (truncated) {
    gaps.push(ListingGapEnum.LINK_LIMIT);
  }

  if (partial) {
    gaps.push(ListingGapEnum.SCROLL_LIMIT);
  }

  return gaps;
}

/**
 * An address without its fragment — the key of a page read
 *
 * @param {string} url
 *
 * @returns {string}
 */
function pageKey(url: string): string {
  const parsed = URL.parse(url);

  if (!parsed) {
    return url;
  }

  parsed.hash = '';

  return parsed.href;
}

/**
 * Reads a listing page after page: the first page, then the next one the pagination of the last page names — by code,
 * never by the LLM — until the list ends, a page is read twice, or `LISTING_MAX_PAGES` / `LISTING_MAX_LINKS` is
 * reached. Each page is fetched politely by the crawler; a refusal of a later page leaves a gap instead of stopping
 * the source, unless the site refused the crawler itself
 */
@Injectable()
export class ListingPagesService {
  /**
   * Logger
   *
   * @var {Logger}
   */
  private readonly logger = new Logger(ListingPagesService.name);

  /**
   * @param {CrawlerService} crawlerService
   * @param {ConfigService<IEnv, true>} configService
   */
  constructor(
    private readonly crawlerService: CrawlerService,
    private readonly configService: ConfigService<IEnv, true>
  ) {}

  /**
   * The links of every page of a listing and the gaps that kept part of it out of sight. The list ends where a page
   * has no pagination, or where its next page is one already read — a "Next" looping back, a page past the last one
   * sent back to the first. It is incomplete where a next page is left: one without an address, past
   * `LISTING_MAX_PAGES`, not read, or not needed because the links are already at `LISTING_MAX_LINKS`
   *
   * @param {string} url Address of the first page
   * @param {SourceFetchModeEnum} mode
   *
   * @throws {CrawlError} Any refusal of the first page, and `SOURCE_BLOCKED` of any page
   *
   * @returns {Promise<IListingLinks>}
   */
  async read(url: string, mode: SourceFetchModeEnum): Promise<IListingLinks> {
    const maxPages = this.configService.get('LISTING_MAX_PAGES', { infer: true });
    const maxLinks = this.configService.get('LISTING_MAX_LINKS', { infer: true });
    const first = await this.crawlerService.fetchPage(url, mode);
    const read = new Set([pageKey(url), pageKey(first.url)]);
    const pages: ILinkCandidates[] = [extractLinkCandidates(first.html, first.url, maxLinks)];
    let pagination = findPagination(first.html, first.url);
    let partial = first.partial === true;
    let paginated = false;
    let full = false;

    while (pagination) {
      const nextURL = pagination.nextURL;

      if (nextURL === undefined) {
        paginated = true;

        break;
      }

      if (read.has(nextURL)) {
        break;
      }

      if (this.isFull(pages, maxLinks)) {
        full = true;

        break;
      }

      if (pages.length >= maxPages) {
        paginated = true;

        break;
      }

      const next = await this.fetchNext(nextURL, mode);

      if (!next) {
        paginated = true;

        break;
      }

      if (read.has(pageKey(next.url))) {
        break;
      }

      read.add(nextURL).add(pageKey(next.url));
      pages.push(extractLinkCandidates(next.html, next.url, maxLinks));
      partial ||= next.partial === true;
      pagination = findPagination(next.html, next.url);
    }

    const merged = mergeLinkCandidates(pages, maxLinks);

    this.logger.debug({ message: 'Listing read', pages: pages.length, links: merged.candidates.length, paginated });

    return {
      url: first.url,
      pages: pages.length,
      candidates: merged.candidates,
      gaps: listingGaps(paginated, merged.truncated || full, partial)
    };
  }

  /**
   * True when the links of the pages read already fill the limit — a next page would only be cut off
   *
   * @param {readonly ILinkCandidates[]} pages
   * @param {number} maxLinks
   *
   * @returns {boolean}
   */
  private isFull(pages: readonly ILinkCandidates[], maxLinks: number): boolean {
    const merged = mergeLinkCandidates(pages, maxLinks);

    return merged.truncated || merged.candidates.length >= maxLinks;
  }

  /**
   * A next page of the listing, or undefined when it was not read: robots.txt forbids it, it failed to load, or its
   * address was refused — what was read is still written, with a gap
   *
   * @param {string} url
   * @param {SourceFetchModeEnum} mode
   *
   * @throws {CrawlError} `SOURCE_BLOCKED` — the site refused the crawler, the source stops as on the first page
   * @throws {Error} Any error that is not a refusal of the crawler — a bug is not a gap
   *
   * @returns {Promise<IFetchedPage | undefined>}
   */
  private async fetchNext(url: string, mode: SourceFetchModeEnum): Promise<IFetchedPage | undefined> {
    try {
      return await this.crawlerService.fetchPage(url, mode);
    } catch (error) {
      if (!(error instanceof CrawlError) || error.code === CrawlErrorCodeEnum.SOURCE_BLOCKED) {
        throw error;
      }

      this.logger.warn({ message: 'Listing page not read, the listing is incomplete', url, code: error.code, reason: error.message });

      return undefined;
    }
  }
}
