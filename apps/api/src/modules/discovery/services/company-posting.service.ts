import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { IEnv } from '../../../config/env.schema.js';
import { boardIdentity, parseATSBoard } from '../../ats/helpers/a-t-s-board.helper.js';
import type { IATSBoard } from '../../ats/interfaces/a-t-s-board.interface.js';
import type { IATSListing } from '../../ats/interfaces/a-t-s-client.interface.js';
import { ATSListingService } from '../../search/services/a-t-s-listing.service.js';
import { normalizeCompany, vacancyDedupKey } from '../../vacancies/helpers/vacancy-key.helper.js';
import type { VacancyRowType } from '../../vacancies/interfaces/vacancy-row.interface.js';
import { BraveSearchClient } from '../clients/brave-search.client.js';
import { ATS_BOARD_SITES } from '../helpers/discovery-query.helper.js';
import type { ICompanyPosting } from '../interfaces/company-posting.interface.js';

/**
 * Boards read per vacancy at most — the first results are the company's own board, the rest are noise
 *
 * @type {number}
 */
const MAX_BOARDS = 3;

/**
 * A company name reduced to its letters and digits, so `Palo Alto Networks` and the board `paloaltonetworks` compare
 *
 * @param {string} company
 *
 * @returns {string}
 */
function compactCompany(company: string): string {
  return normalizeCompany(company).replaceAll(/[^\p{L}\p{N}]+/gu, '');
}

/**
 * Finds a vacancy of a site the crawler never opens (LinkedIn, Glassdoor) on the board of its company in an applicant
 * tracking system: a web search by the company on each board site, the boards of the company read through their APIs,
 * the position with the same title. Only the board the search leads to is kept, never the results (ADR-021)
 */
@Injectable()
export class CompanyPostingService {
  /**
   * Logger
   *
   * @var {Logger}
   */
  private readonly logger = new Logger(CompanyPostingService.name);

  /**
   * @param {ATSListingService} atsListingService
   * @param {BraveSearchClient} braveSearchClient
   * @param {ConfigService<IEnv, true>} configService
   */
  constructor(
    private readonly atsListingService: ATSListingService,
    private readonly braveSearchClient: BraveSearchClient,
    private readonly configService: ConfigService<IEnv, true>
  ) {}

  /**
   * True when the web search has a key
   *
   * @returns {boolean}
   */
  isEnabled(): boolean {
    return this.braveSearchClient.isEnabled();
  }

  /**
   * The posting of the vacancy on a board of its company; undefined when none is found or the search has no key
   *
   * @param {VacancyRowType} vacancy
   *
   * @throws {Error} `BRAVE_SEARCH_UNAUTHORIZED`, `BRAVE_SEARCH_RATE_LIMITED` or `BRAVE_SEARCH_FAILED` from the search
   *
   * @returns {Promise<ICompanyPosting | undefined>}
   */
  async find(vacancy: VacancyRowType): Promise<ICompanyPosting | undefined> {
    if (!this.isEnabled()) {
      return undefined;
    }

    for (const board of await this.searchBoards(vacancy.vacancy_company)) {
      const listing = await this.readBoard(board);

      if (!listing || !this.isCompanyBoard(board, listing, vacancy.vacancy_company)) {
        continue;
      }

      const position = listing.positions.find(
        candidate =>
          vacancyDedupKey(vacancy.vacancy_company, candidate.title) === vacancy.vacancy_dedup_key &&
          (!candidate.country || !vacancy.vacancy_country || candidate.country === vacancy.vacancy_country)
      );

      if (position) {
        this.logger.debug({ message: 'Company posting found', vacancyId: vacancy.vacancy_id, kind: board.kind, board: board.board });

        return { url: position.url, externalId: position.externalId };
      }
    }

    return undefined;
  }

  /**
   * Distinct boards the search by the company leads to, at most `MAX_BOARDS`
   *
   * @param {string} company
   *
   * @returns {Promise<IATSBoard[]>}
   */
  private async searchBoards(company: string): Promise<IATSBoard[]> {
    const boards = new Map<string, IATSBoard>();

    for (const site of ATS_BOARD_SITES) {
      const urls = await this.braveSearchClient.search(`site:${site} "${company.replaceAll('"', '')}"`);

      for (const board of urls.map(url => parseATSBoard(url)).filter(found => found !== undefined)) {
        boards.set(boardIdentity(board), board);
      }

      if (boards.size >= MAX_BOARDS) {
        break;
      }
    }

    return [...boards.values()].slice(0, MAX_BOARDS);
  }

  /**
   * The positions of a board; undefined for a board not read in time or refused
   *
   * @param {IATSBoard} board
   *
   * @returns {Promise<IATSListing | undefined>}
   */
  private async readBoard(board: IATSBoard): Promise<IATSListing | undefined> {
    try {
      return await this.atsListingService.fetchBoard(board, this.configService.get('DISCOVER_BOARD_TIMEOUT_MS', { infer: true }));
    } catch (error) {
      this.logger.debug({ message: 'Board not read', kind: board.kind, board: board.board, reason: (error as Error).message });

      return undefined;
    }
  }

  /**
   * True when the board belongs to the company: its name, or the name of the board, is the company's
   *
   * @param {IATSBoard} board
   * @param {IATSListing} listing
   * @param {string} company
   *
   * @returns {boolean}
   */
  private isCompanyBoard(board: IATSBoard, listing: IATSListing, company: string): boolean {
    const wanted = compactCompany(company);

    return wanted !== '' && [listing.company ?? '', board.board].some(name => compactCompany(name) === wanted);
  }
}
