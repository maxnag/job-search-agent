import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';

import { ATSKindEnum, SourceFetchModeEnum } from '@job-agent/shared';

import { CrawlErrorCodeEnum } from '../../crawler/enums/crawl-error-code.enum.js';
import { CrawlError } from '../../crawler/errors/crawl.error.js';
import { CrawlerService } from '../../crawler/services/crawler.service.js';
import { boardURL } from '../helpers/a-t-s-board.helper.js';
import { atsWorkMode, clipATSPosition } from '../helpers/a-t-s-position.helper.js';
import { validItems, validateATSResponse } from '../helpers/a-t-s-response.helper.js';
import { escapeHTML, postingHTML } from '../helpers/posting-h-t-m-l.helper.js';
import { scriptJSON } from '../helpers/script-json.helper.js';
import type { IATSClient, IATSListing, IATSPostingRequest } from '../interfaces/a-t-s-client.interface.js';
import { comeetCompanySchema } from '../schemas/comeet-company.schema.js';
import { type ComeetPositionType, comeetPositionSchema } from '../schemas/comeet-position.schema.js';

/**
 * Variable of the board page that holds every published position
 *
 * @type {string}
 */
const POSITIONS_VARIABLE = 'COMPANY_POSITIONS_DATA';

/**
 * Variable of the board page that holds the company
 *
 * @type {string}
 */
const COMPANY_VARIABLE = 'COMPANY_DATA';

/**
 * Variable of a position page that holds the position
 *
 * @type {string}
 */
const POSITION_VARIABLE = 'POSITION_DATA';

/**
 * The position list of a board page; each position is checked on its own
 *
 * @type {z.ZodArray}
 */
const POSITION_LIST = z.array(z.unknown());

/**
 * Reads a Comeet board from its public hosted pages: the board page embeds every published position with its
 * description, a position page embeds the position. Comeet redirects a position that is gone to the board page and a
 * board that is gone to its home page — both read as a missing page. The Careers API and its token are not used
 */
@Injectable()
export class ComeetClient implements IATSClient {
  /**
   * The system the client reads
   *
   * @var {ATSKindEnum}
   */
  readonly kind = ATSKindEnum.COMEET;

  /**
   * Logger
   *
   * @var {Logger}
   */
  private readonly logger = new Logger(ComeetClient.name);

  /**
   * @param {CrawlerService} crawlerService
   */
  constructor(private readonly crawlerService: CrawlerService) {}

  /**
   * Every published position of a board
   *
   * @param {string} board
   * @param {number} [timeoutMs]
   *
   * @throws {CrawlError} If the page was not fetched; `FETCH_HTTP_ERROR` for a board that is gone
   * @throws {Error} `ATS_RESPONSE_INVALID` if the embedded positions do not match the schema
   *
   * @returns {Promise<IATSListing>}
   */
  async listPositions(board: string, timeoutMs?: number): Promise<IATSListing> {
    const url = boardURL({ kind: this.kind, board });
    const page = await this.crawlerService.fetchPage(url, SourceFetchModeEnum.HTML, { timeoutMs });
    const embedded = scriptJSON(page.html, POSITIONS_VARIABLE);

    if (embedded === undefined) {
      throw new CrawlError(CrawlErrorCodeEnum.FETCH_HTTP_ERROR, `${url}: the page has no positions, the board is gone`);
    }

    const list = validateATSResponse(embedded, POSITION_LIST, `Comeet board ${board}`);
    const { valid, dropped } = validItems(list, comeetPositionSchema);
    const company = comeetCompanySchema.safeParse(scriptJSON(page.html, COMPANY_VARIABLE));

    if (dropped > 0) {
      this.logger.warn({ message: 'Board jobs dropped by the schema', kind: this.kind, board, dropped });
    }

    return {
      company: company.success ? company.data.name : (valid.find(position => position.company_name)?.company_name ?? null),
      positions: valid.map(position =>
        clipATSPosition({
          externalId: position.uid,
          url: position.url_comeet_hosted_page,
          title: position.name,
          country: position.location?.country ?? null,
          city: position.location?.city ?? null,
          workMode: atsWorkMode(position.workplace_type),
          location: position.location?.name ?? null,
          department: position.department ?? null
        })
      )
    };
  }

  /**
   * The posting of one position from its hosted page: title, company, location, work mode, employment type,
   * experience level and department, then the description and the requirements
   *
   * @param {IATSPostingRequest} request
   *
   * @throws {CrawlError} If the page was not fetched; `FETCH_HTTP_ERROR` for a position that is gone
   * @throws {Error} `ATS_RESPONSE_INVALID` if the embedded position does not match the schema
   *
   * @returns {Promise<string>}
   */
  async fetchPosting(request: IATSPostingRequest): Promise<string> {
    const page = await this.crawlerService.fetchPage(request.url, SourceFetchModeEnum.HTML);
    const embedded = scriptJSON(page.html, POSITION_VARIABLE);

    if (embedded === undefined) {
      throw new CrawlError(CrawlErrorCodeEnum.FETCH_HTTP_ERROR, `${request.url}: the page has no position, the position is gone`);
    }

    const position = validateATSResponse(embedded, comeetPositionSchema, `Comeet position ${request.board}/${request.externalId}`);

    return postingHTML(
      header(position),
      (position.custom_fields?.details ?? []).map(detail => `<h3>${escapeHTML(detail.name ?? '')}</h3>${detail.value ?? ''}`)
    );
  }
}

/**
 * Header lines of a position
 *
 * @param {ComeetPositionType} position
 *
 * @returns {(string | null | undefined)[]}
 */
function header(position: ComeetPositionType): (string | null | undefined)[] {
  return [
    position.name,
    position.company_name,
    position.location?.name,
    position.workplace_type,
    position.employment_type,
    position.experience_level,
    position.department
  ];
}
