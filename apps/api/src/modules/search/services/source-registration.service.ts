import { Injectable, Logger } from '@nestjs/common';

import { SourceFetchModeEnum } from '@job-agent/shared';

import { boardURL, parseATSBoard } from '../../ats/helpers/a-t-s-board.helper.js';
import type { IATSBoard } from '../../ats/interfaces/a-t-s-board.interface.js';
import { VACANCY_FIELD_LIMITS, clipText } from '../../vacancies/helpers/vacancy-fields.helper.js';
import type { ISourceRegistrationRequest, ISourceRegistrationResult } from '../interfaces/source-registration.interface.js';
import { SourceRepository } from '../repositories/source.repository.js';
import { ATSListingService } from './a-t-s-listing.service.js';
import { ProfilePreferencesService } from './profile-preferences.service.js';

/**
 * Protocols a career page may have
 *
 * @type {ReadonlySet<string>}
 */
const WEB_PROTOCOLS: ReadonlySet<string> = new Set(['http:', 'https:']);

/**
 * Adds a career page as a source: a link to an applicant tracking system becomes the canonical URL of its board with
 * fetch mode `ats`, read once to show what it holds; any other page becomes an `html` source as given
 */
@Injectable()
export class SourceRegistrationService {
  /**
   * Logger
   *
   * @var {Logger}
   */
  private readonly logger = new Logger(SourceRegistrationService.name);

  /**
   * @param {ATSListingService} atsListingService
   * @param {ProfilePreferencesService} profilePreferencesService
   * @param {SourceRepository} sourceRepository
   */
  constructor(
    private readonly atsListingService: ATSListingService,
    private readonly profilePreferencesService: ProfilePreferencesService,
    private readonly sourceRepository: SourceRepository
  ) {}

  /**
   * Add a source, or name the one that already has the URL
   *
   * @param {ISourceRegistrationRequest} request
   *
   * @throws {Error} `SOURCE_URL_INVALID` if the link is not an http(s) URL
   * @throws {CrawlError} If the board was not read — the source is not added
   * @throws {Error} `ATS_RESPONSE_INVALID` if the board answer does not match its schema — the source is not added
   *
   * @returns {Promise<ISourceRegistrationResult>}
   */
  async add(request: ISourceRegistrationRequest): Promise<ISourceRegistrationResult> {
    const board = parseATSBoard(request.url);

    return board ? this.addBoard(board, request.name) : this.addPage(request);
  }

  /**
   * Add the board of an applicant tracking system, after reading it once
   *
   * @param {IATSBoard} board
   * @param {string | undefined} name
   *
   * @returns {Promise<ISourceRegistrationResult>}
   */
  private async addBoard(board: IATSBoard, name: string | undefined): Promise<ISourceRegistrationResult> {
    const url = boardURL(board);
    const existing = await this.sourceRepository.findByURL(url);

    if (existing) {
      return { source: existing, created: false, board };
    }

    const listing = await this.atsListingService.fetchBoard(board);
    const company = clipText(name?.trim() || listing.company?.trim() || board.board, VACANCY_FIELD_LIMITS.company);
    const profiles = await this.profilePreferencesService.findAll();
    const passing = this.atsListingService.countPassing(listing, company, profiles);
    const result = await this.create({ url, name: company }, SourceFetchModeEnum.ATS);

    const located = listing.positions.filter(position => position.country !== null).length;

    return { ...result, board, positions: listing.positions.length, passing, located };
  }

  /**
   * Add a career page that is not a board — fetched as plain HTML
   *
   * @param {ISourceRegistrationRequest} request
   *
   * @throws {Error} `SOURCE_URL_INVALID` if the link is not an http(s) URL
   *
   * @returns {Promise<ISourceRegistrationResult>}
   */
  private async addPage(request: ISourceRegistrationRequest): Promise<ISourceRegistrationResult> {
    const parsed = URL.parse(request.url);

    if (!parsed || !WEB_PROTOCOLS.has(parsed.protocol)) {
      throw new Error(`SOURCE_URL_INVALID: ${request.url} is not an http(s) link`);
    }

    const name = request.name?.trim() || parsed.hostname.replace(/^www\./, '');

    return this.create({ url: parsed.href, name: clipText(name, VACANCY_FIELD_LIMITS.company) }, SourceFetchModeEnum.HTML);
  }

  /**
   * Insert the source, or return the one that won the URL meanwhile
   *
   * @param {Required<ISourceRegistrationRequest>} values
   * @param {SourceFetchModeEnum} mode
   *
   * @throws {Error} `SOURCE_NOT_FOUND` if the URL is taken but its row is gone
   *
   * @returns {Promise<ISourceRegistrationResult>}
   */
  private async create(values: Required<ISourceRegistrationRequest>, mode: SourceFetchModeEnum): Promise<ISourceRegistrationResult> {
    const created = await this.sourceRepository.create({ source_url: values.url, source_name: values.name, source_fetch_mode: mode });

    if (created) {
      this.logger.log({ message: 'Source added', sourceId: created.source_id, mode });

      return { source: created, created: true };
    }

    const existing = await this.sourceRepository.findByURL(values.url);

    if (!existing) {
      throw new Error(`SOURCE_NOT_FOUND: ${values.url}`);
    }

    return { source: existing, created: false };
  }
}
