import { readFile } from 'node:fs/promises';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { LLMStepEnum } from '@job-agent/shared';

import type { IEnv } from '../../../config/env.schema.js';
import type { IFetchedPage } from '../../crawler/interfaces/fetched-page.interface.js';
import { LLMClient } from '../../llm/clients/l-l-m.client.js';
import { fenceUntrusted } from '../../llm/helpers/untrusted-text.helper.js';
import { VACANCY_FIELD_LIMITS, clipNullable, clipText } from '../../vacancies/helpers/vacancy-fields.helper.js';
import { extractLinkCandidates, renderLinkCandidates } from '../helpers/listing-page.helper.js';
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
 * Turns a listing page into its positions: the page is reduced to numbered links by code, the LLM picks and
 * classifies the vacancies among them, code maps the numbers back to the URLs
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
   * Positions of a listing page; a page without links costs no LLM call
   *
   * @param {IFetchedPage} page
   * @param {string} sourceName Company of the positions the page does not name a company for
   *
   * @throws {Error} `LLM_OUTPUT_SCHEMA_INVALID` if the answer does not match the schema
   *
   * @returns {Promise<IListingExtraction>}
   */
  async extract(page: IFetchedPage, sourceName: string): Promise<IListingExtraction> {
    const candidates = extractLinkCandidates(page.html, page.url, this.configService.get('LISTING_MAX_LINKS', { infer: true }));

    if (candidates.length === 0) {
      return { links: 0, positions: [] };
    }

    const { data, model } = await this.llmClient.generateBySchema({
      step: LLMStepEnum.LISTING,
      system: await readFile(PROMPT_URL, 'utf8'),
      prompt: fenceUntrusted(LINKS_TAG, renderLinkCandidates(page.url, candidates)),
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

    this.logger.debug({ message: 'Listing extracted', model, links: candidates.length, positions: byURL.size });

    return { links: candidates.length, positions: [...byURL.values()] };
  }
}
