import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';

import { ATSKindEnum, SourceFetchModeEnum } from '@job-agent/shared';

import { CrawlPaceEnum } from '../../crawler/enums/crawl-pace.enum.js';
import { CrawlerService } from '../../crawler/services/crawler.service.js';
import { atsWorkMode, clipATSPosition } from '../helpers/a-t-s-position.helper.js';
import { parseATSResponse, validItems } from '../helpers/a-t-s-response.helper.js';
import { escapeHTML, postingHTML } from '../helpers/posting-h-t-m-l.helper.js';
import type { IATSClient, IATSListing, IATSPostingRequest } from '../interfaces/a-t-s-client.interface.js';
import { leverPostingSchema } from '../schemas/lever-posting.schema.js';

/**
 * Base of the Lever Postings API (the global region)
 *
 * @type {string}
 */
const API_BASE = 'https://api.lever.co/v0/postings';

/**
 * The posting list of the Lever Postings API; each posting is checked on its own
 *
 * @type {z.ZodArray}
 */
const POSTING_LIST = z.array(z.unknown());

/**
 * Reads a Lever job site through the public Postings API. Site names are case-sensitive; the API gives the country and
 * the work mode as fields, but no company name
 */
@Injectable()
export class LeverClient implements IATSClient {
  /**
   * The system the client reads
   *
   * @var {ATSKindEnum}
   */
  readonly kind = ATSKindEnum.LEVER;

  /**
   * Logger
   *
   * @var {Logger}
   */
  private readonly logger = new Logger(LeverClient.name);

  /**
   * @param {CrawlerService} crawlerService
   */
  constructor(private readonly crawlerService: CrawlerService) {}

  /**
   * Every published posting of a site
   *
   * @param {string} board
   * @param {number} [timeoutMs]
   *
   * @throws {CrawlError} If the list was not fetched — `FETCH_HTTP_ERROR` for a site that does not exist
   * @throws {Error} `ATS_RESPONSE_INVALID` if the answer is not the posting list
   *
   * @returns {Promise<IATSListing>}
   */
  async listPositions(board: string, timeoutMs?: number): Promise<IATSListing> {
    const page = await this.crawlerService.fetchPage(`${API_BASE}/${encodeURIComponent(board)}?mode=json`, SourceFetchModeEnum.HTML, {
      timeoutMs,
      pace: CrawlPaceEnum.API
    });
    const list = parseATSResponse(page.html, POSTING_LIST, `Lever site ${board}`);
    const { valid, dropped } = validItems(list, leverPostingSchema);

    if (dropped > 0) {
      this.logger.warn({ message: 'Board jobs dropped by the schema', kind: this.kind, board, dropped });
    }

    return {
      company: null,
      positions: valid.map(posting =>
        clipATSPosition({
          externalId: posting.id,
          url: posting.hostedUrl,
          title: posting.text,
          country: posting.country ?? null,
          city: null,
          workMode: atsWorkMode(posting.workplaceType),
          location: posting.categories?.allLocations?.join('; ') || posting.categories?.location || null,
          department: posting.categories?.team ?? posting.categories?.department ?? null
        })
      )
    };
  }

  /**
   * The posting of one position: title, locations, commitment, work mode and team, then the description, its lists
   * and the closing part
   *
   * @param {IATSPostingRequest} request
   *
   * @throws {CrawlError} If the posting was not fetched — `FETCH_HTTP_ERROR` for a posting that is gone
   * @throws {Error} `ATS_RESPONSE_INVALID` if the answer is not a posting
   *
   * @returns {Promise<string>}
   */
  async fetchPosting(request: IATSPostingRequest): Promise<string> {
    const url = `${API_BASE}/${encodeURIComponent(request.board)}/${encodeURIComponent(request.externalId)}?mode=json`;
    const page = await this.crawlerService.fetchPage(url, SourceFetchModeEnum.HTML, { pace: CrawlPaceEnum.API });
    const posting = parseATSResponse(page.html, leverPostingSchema, `Lever posting ${request.board}/${request.externalId}`);
    const categories = posting.categories;

    return postingHTML(
      [
        posting.text,
        categories?.allLocations?.join('; ') || categories?.location,
        categories?.commitment,
        posting.workplaceType,
        categories?.team ?? categories?.department
      ],
      [
        posting.description ?? '',
        ...(posting.lists ?? []).map(list => `<h3>${escapeHTML(list.text)}</h3>${list.content}`),
        posting.additional ?? ''
      ]
    );
  }
}
