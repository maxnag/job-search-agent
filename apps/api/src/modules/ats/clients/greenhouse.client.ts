import { Injectable, Logger } from '@nestjs/common';
import { load } from 'cheerio';

import { ATSKindEnum, SourceFetchModeEnum } from '@job-agent/shared';

import { CrawlPaceEnum } from '../../crawler/enums/crawl-pace.enum.js';
import { CrawlerService } from '../../crawler/services/crawler.service.js';
import { clipATSPosition } from '../helpers/a-t-s-position.helper.js';
import { parseATSResponse, validItems } from '../helpers/a-t-s-response.helper.js';
import { postingHTML } from '../helpers/posting-h-t-m-l.helper.js';
import type { IATSClient, IATSListing, IATSPostingRequest } from '../interfaces/a-t-s-client.interface.js';
import { type GreenhouseJobType, greenhouseJobSchema } from '../schemas/greenhouse-job.schema.js';
import { greenhouseJobsSchema } from '../schemas/greenhouse-jobs.schema.js';

/**
 * Base of the Greenhouse Job Board API
 *
 * @type {string}
 */
const API_BASE = 'https://boards-api.greenhouse.io/v1/boards';

/**
 * Reads a Greenhouse board through the public Job Board API. The list carries no country or work mode as fields —
 * only the location as the company wrote it
 */
@Injectable()
export class GreenhouseClient implements IATSClient {
  /**
   * The system the client reads
   *
   * @var {ATSKindEnum}
   */
  readonly kind = ATSKindEnum.GREENHOUSE;

  /**
   * Logger
   *
   * @var {Logger}
   */
  private readonly logger = new Logger(GreenhouseClient.name);

  /**
   * @param {CrawlerService} crawlerService
   */
  constructor(private readonly crawlerService: CrawlerService) {}

  /**
   * Every published job of a board
   *
   * @param {string} board
   * @param {number} [timeoutMs]
   *
   * @throws {CrawlError} If the list was not fetched — `FETCH_HTTP_ERROR` for a board that does not exist
   * @throws {Error} `ATS_RESPONSE_INVALID` if the answer is not the job list
   *
   * @returns {Promise<IATSListing>}
   */
  async listPositions(board: string, timeoutMs?: number): Promise<IATSListing> {
    const page = await this.crawlerService.fetchPage(`${API_BASE}/${encodeURIComponent(board)}/jobs`, SourceFetchModeEnum.HTML, {
      timeoutMs,
      pace: CrawlPaceEnum.API
    });
    const list = parseATSResponse(page.html, greenhouseJobsSchema, `Greenhouse board ${board}`);
    const { valid, dropped } = validItems(list.jobs, greenhouseJobSchema);

    if (dropped > 0) {
      this.logger.warn({ message: 'Board jobs dropped by the schema', kind: this.kind, board, dropped });
    }

    return {
      company: valid.find(job => job.company_name)?.company_name ?? null,
      positions: valid.map(job =>
        clipATSPosition({
          externalId: `${job.id}`,
          url: job.absolute_url,
          title: job.title,
          country: null,
          city: null,
          workMode: null,
          location: job.location?.name ?? null,
          department: null
        })
      )
    };
  }

  /**
   * The posting of one job: title, company, location, departments and offices, then the description
   *
   * @param {IATSPostingRequest} request
   *
   * @throws {CrawlError} If the job was not fetched — `FETCH_HTTP_ERROR` for a job that is gone
   * @throws {Error} `ATS_RESPONSE_INVALID` if the answer is not a job
   *
   * @returns {Promise<string>}
   */
  async fetchPosting(request: IATSPostingRequest): Promise<string> {
    const url = `${API_BASE}/${encodeURIComponent(request.board)}/jobs/${encodeURIComponent(request.externalId)}`;
    const page = await this.crawlerService.fetchPage(url, SourceFetchModeEnum.HTML, { pace: CrawlPaceEnum.API });
    const job = parseATSResponse(page.html, greenhouseJobSchema, `Greenhouse job ${request.board}/${request.externalId}`);

    return postingHTML(
      [job.title, job.company_name, job.location?.name, names(job.departments), names(job.offices)],
      job.content ? [load(job.content).root().text()] : []
    );
  }
}

/**
 * Names of departments or offices in one line
 *
 * @param {GreenhouseJobType['departments']} items
 *
 * @returns {string | undefined}
 */
function names(items: GreenhouseJobType['departments']): string | undefined {
  return items?.map(item => item.name.trim()).join(', ');
}
