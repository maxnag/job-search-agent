import { readFile } from 'node:fs/promises';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { LLMStepEnum } from '@job-agent/shared';

import type { IEnv } from '../../../config/env.schema.js';
import type { IFetchedPage } from '../../crawler/interfaces/fetched-page.interface.js';
import { LLMClient } from '../../llm/clients/l-l-m.client.js';
import { fenceUntrusted } from '../../llm/helpers/untrusted-text.helper.js';
import { VACANCY_FIELD_LIMITS, clipNullable, clipText } from '../../vacancies/helpers/vacancy-fields.helper.js';
import { ListingGapEnum } from '../enums/listing-gap.enum.js';
import { extractLinkCandidates, renderLinkCandidates } from '../helpers/listing-page.helper.js';
import { findPagination } from '../helpers/listing-pagination.helper.js';
import type { ILinkCandidate } from '../interfaces/link-candidate.interface.js';
import type { IListedPosition } from '../interfaces/listed-position.interface.js';
import type { IListingExtraction } from '../interfaces/listing-extraction.interface.js';
import { vacancyListingSchema } from '../schemas/vacancy-listing.schema.js';

/**
 * Prompt of the listing step, copied next to the compiled code by the build
 *
 * @type {URL}
 */
const PROMPT_URL = new URL('../prompts/vacancy-listing.md', import.meta.url);

/**
 * Tag the links are fenced in — the prompt names it
 *
 * @type {string}
 */
const LINKS_TAG = 'links';

/**
 * Gaps of a listing page, in a fixed order
 *
 * @param {boolean} paginated The page links to more of the list
 * @param {boolean} truncated The link limit cut the list short
 * @param {boolean} partial The scrolling stopped while links were still growing
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
 * Turns a listing into its positions: a page is reduced to numbered links by code, the LLM picks and classifies the
 * vacancies among them, code maps the numbers back to the URLs. The positions of an applicant tracking system come as
 * such links too — the LLM only classifies them
 */
@Injectable()
export class ListingExtractionService {
  /**
   * Logger
   *
   * @var {Logger}
   */
  private readonly logger = new Logger(ListingExtractionService.name);

  /**
   * @param {LLMClient} llmClient
   * @param {ConfigService<IEnv, true>} configService
   */
  constructor(
    private readonly llmClient: LLMClient,
    private readonly configService: ConfigService<IEnv, true>
  ) {}

  /**
   * Positions of a listing page and the gaps that kept part of the list out of sight — pagination, the link limit, a
   * scroll stopped early; a page without links costs no LLM call
   *
   * @param {IFetchedPage} page
   * @param {string} sourceName Company of the positions the page does not name a company for
   *
   * @throws {Error} `LLM_OUTPUT_SCHEMA_INVALID` if the answer does not match the schema
   *
   * @returns {Promise<IListingExtraction>}
   */
  async extract(page: IFetchedPage, sourceName: string): Promise<IListingExtraction> {
    const { candidates, truncated } = extractLinkCandidates(
      page.html,
      page.url,
      this.configService.get('LISTING_MAX_LINKS', { infer: true })
    );
    const gaps = listingGaps(findPagination(page.html, page.url) !== undefined, truncated, page.partial === true);

    if (candidates.length === 0) {
      return { links: 0, positions: [], gaps };
    }

    return { links: candidates.length, positions: await this.classify(page.url, candidates, sourceName), gaps };
  }

  /**
   * The links that are vacancies, classified by the LLM — at most `LISTING_BATCH_SIZE` links per call, so the answer
   * fits the output limit even when every link is a posting; no link, no call
   *
   * @param {string} pageURL Address of the listing the links come from
   * @param {readonly ILinkCandidate[]} candidates
   * @param {string} sourceName Company of the positions the listing does not name a company for
   * @param {boolean} [withURLs] False when every link is a posting and its URL tells the LLM nothing
   *
   * @throws {Error} `LLM_OUTPUT_SCHEMA_INVALID` if an answer does not match the schema
   *
   * @returns {Promise<IListedPosition[]>}
   */
  async classify(pageURL: string, candidates: readonly ILinkCandidate[], sourceName: string, withURLs = true): Promise<IListedPosition[]> {
    const chunkSize = this.configService.get('LISTING_BATCH_SIZE', { infer: true });
    const byURL = new Map<string, IListedPosition>();

    for (let start = 0; start < candidates.length; start += chunkSize) {
      const positions = await this.classifyChunk(pageURL, candidates.slice(start, start + chunkSize), sourceName, withURLs);

      for (const position of positions) {
        if (!byURL.has(position.url)) {
          byURL.set(position.url, position);
        }
      }
    }

    return [...byURL.values()];
  }

  /**
   * One LLM call over a part of the links
   *
   * @param {string} pageURL
   * @param {readonly ILinkCandidate[]} candidates
   * @param {string} sourceName
   * @param {boolean} withURLs
   *
   * @throws {Error} `LLM_OUTPUT_SCHEMA_INVALID` if the answer does not match the schema
   *
   * @returns {Promise<IListedPosition[]>}
   */
  private async classifyChunk(
    pageURL: string,
    candidates: readonly ILinkCandidate[],
    sourceName: string,
    withURLs: boolean
  ): Promise<IListedPosition[]> {
    const { data, model } = await this.llmClient.generateBySchema({
      step: LLMStepEnum.LISTING,
      system: await readFile(PROMPT_URL, 'utf8'),
      prompt: fenceUntrusted(LINKS_TAG, renderLinkCandidates(pageURL, candidates, withURLs)),
      schema: vacancyListingSchema
    });
    const byURL = new Map<string, IListedPosition>();
    let unknownLinks = 0;

    for (const position of data.positions) {
      const candidate = candidates[position.link];

      if (!candidate) {
        unknownLinks++;

        continue;
      }

      if (byURL.has(candidate.url)) {
        continue;
      }

      byURL.set(candidate.url, {
        url: candidate.url,
        title: clipText(position.title, VACANCY_FIELD_LIMITS.title),
        company: clipText(position.company?.trim() || sourceName, VACANCY_FIELD_LIMITS.company),
        country: position.country?.toUpperCase() ?? null,
        city: clipNullable(position.city, VACANCY_FIELD_LIMITS.city),
        workMode: position.work_mode,
        roleFamily: position.role_family,
        level: position.level
      });
    }

    if (unknownLinks > 0) {
      this.logger.warn({ message: 'Listing answer named links the page does not have', model, unknownLinks });
    }

    this.logger.debug({ message: 'Listing classified', model, links: candidates.length, positions: byURL.size });

    return [...byURL.values()];
  }
}
