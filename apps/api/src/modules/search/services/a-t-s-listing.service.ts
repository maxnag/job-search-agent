import { Injectable, Logger } from '@nestjs/common';

import { boardURL, parseATSBoard } from '../../ats/helpers/a-t-s-board.helper.js';
import type { IATSBoard } from '../../ats/interfaces/a-t-s-board.interface.js';
import type { IATSListing, IATSPosition } from '../../ats/interfaces/a-t-s-client.interface.js';
import { ATSClientRegistry } from '../../ats/services/a-t-s-client.registry.js';
import { VACANCY_FIELD_LIMITS, clipText } from '../../vacancies/helpers/vacancy-fields.helper.js';
import { listingSkipReason } from '../helpers/listing-filter.helper.js';
import type { ILinkCandidate } from '../interfaces/link-candidate.interface.js';
import type { IListedPosition } from '../interfaces/listed-position.interface.js';
import type { IListingExtraction } from '../interfaces/listing-extraction.interface.js';
import type { IProfilePreferencesEntry } from '../interfaces/profile-preferences-entry.interface.js';
import type { SourceRowType } from '../interfaces/source-row.interface.js';
import { ListingExtractionService } from './listing-extraction.service.js';

/**
 * Separator of the fields given to the LLM next to a title
 *
 * @type {string}
 */
const CONTEXT_SEPARATOR = ' · ';

/**
 * The listing of an `ats` source: the board gives the positions with their place as fields, code drops the ones no
 * profile wants by company and place, the LLM classifies only the rest by title — role family and level. A field of
 * the board wins over the LLM reading of the same field
 */
@Injectable()
export class ATSListingService {
  /**
   * Logger
   *
   * @var {Logger}
   */
  private readonly logger = new Logger(ATSListingService.name);

  /**
   * @param {ListingExtractionService} listingExtractionService
   * @param {ATSClientRegistry} atsClientRegistry
   */
  constructor(
    private readonly listingExtractionService: ListingExtractionService,
    private readonly atsClientRegistry: ATSClientRegistry
  ) {}

  /**
   * Every published position of the board of a source
   *
   * @param {SourceRowType} source
   *
   * @throws {Error} `SOURCE_URL_NOT_ATS` if the source URL is not a board of a supported system
   * @throws {CrawlError} If the board was not fetched
   * @throws {Error} `ATS_RESPONSE_INVALID` if the answer of the board does not match its schema
   *
   * @returns {Promise<IATSListing>}
   */
  async fetch(source: SourceRowType): Promise<IATSListing> {
    return this.fetchBoard(this.board(source));
  }

  /**
   * Every published position of a board
   *
   * @param {IATSBoard} board
   * @param {number} [timeoutMs] Limit of the request instead of the crawler's own
   *
   * @throws {CrawlError} If the board was not fetched
   * @throws {Error} `ATS_RESPONSE_INVALID` if the answer of the board does not match its schema
   *
   * @returns {Promise<IATSListing>}
   */
  async fetchBoard(board: IATSBoard, timeoutMs?: number): Promise<IATSListing> {
    return this.atsClientRegistry.findOne(board.kind).listPositions(board.board, timeoutMs);
  }

  /**
   * How many positions of a board some profile wants by company and place — the screening that needs no LLM
   *
   * @param {IATSListing} listing
   * @param {string} company
   * @param {readonly IProfilePreferencesEntry[]} profiles
   *
   * @returns {number}
   */
  countPassing(listing: IATSListing, company: string, profiles: readonly IProfilePreferencesEntry[]): number {
    return this.passingPositions(listing, company, profiles).length;
  }

  /**
   * The positions of a board some profile wants by company and place
   *
   * @param {IATSListing} listing
   * @param {string} company
   * @param {readonly IProfilePreferencesEntry[]} profiles
   *
   * @returns {IATSPosition[]}
   */
  passingPositions(listing: IATSListing, company: string, profiles: readonly IProfilePreferencesEntry[]): IATSPosition[] {
    return listing.positions.filter(position => listingSkipReason(listedPosition(position, company), profiles) === undefined);
  }

  /**
   * Positions of a fetched board: the ones dropped by company and place as they are, the rest classified by the LLM.
   * A board answers with the whole list, so it has no gaps
   *
   * @param {SourceRowType} source
   * @param {IATSListing} listing
   * @param {readonly IProfilePreferencesEntry[]} profiles
   *
   * @throws {Error} `LLM_OUTPUT_SCHEMA_INVALID` if an answer of the LLM does not match the schema
   *
   * @returns {Promise<IListingExtraction>}
   */
  async classify(source: SourceRowType, listing: IATSListing, profiles: readonly IProfilePreferencesEntry[]): Promise<IListingExtraction> {
    const company = clipText(listing.company?.trim() || source.source_name, VACANCY_FIELD_LIMITS.company);
    const listed = listing.positions.map(position => ({ board: position, listed: listedPosition(position, company) }));
    const dropped = listed.filter(item => listingSkipReason(item.listed, profiles) !== undefined).map(item => item.listed);
    const kept = listed.filter(item => !dropped.includes(item.listed));
    const readings = await this.listingExtractionService.classify(
      boardURL(this.board(source)),
      kept.map(item => linkCandidate(item.board)),
      company,
      false
    );
    const byURL = new Map(readings.map(reading => [reading.url, reading]));
    const merged = kept.flatMap(item => {
      const reading = byURL.get(item.listed.url);

      return reading ? [mergeReading(item.listed, reading)] : [];
    });

    this.logger.debug({
      message: 'Board classified',
      sourceId: source.source_id,
      positions: listed.length,
      droppedBeforeLLM: dropped.length,
      classified: merged.length,
      notPostings: kept.length - merged.length
    });

    return { pages: 1, links: listed.length, positions: [...dropped, ...merged], gaps: [] };
  }

  /**
   * The board of a source
   *
   * @param {SourceRowType} source
   *
   * @throws {Error} `SOURCE_URL_NOT_ATS` if the URL is not a board of a supported system
   *
   * @returns {IATSBoard}
   */
  private board(source: SourceRowType): IATSBoard {
    const board = parseATSBoard(source.source_url);

    if (!board) {
      throw new Error(`SOURCE_URL_NOT_ATS: source ${source.source_id} has fetch mode ats, its URL is not a supported board`);
    }

    return board;
  }
}

/**
 * A board position as a listed position, not classified yet
 *
 * @param {IATSPosition} position
 * @param {string} company
 *
 * @returns {IListedPosition}
 */
function listedPosition(position: IATSPosition, company: string): IListedPosition {
  return {
    url: position.url,
    externalId: position.externalId,
    title: position.title,
    company,
    country: position.country,
    city: position.city,
    workMode: position.workMode,
    roleFamily: null,
    level: null
  };
}

/**
 * The link the LLM reads for a position: its title, and its location, department and work mode around it
 *
 * @param {IATSPosition} position
 *
 * @returns {ILinkCandidate}
 */
function linkCandidate(position: IATSPosition): ILinkCandidate {
  const context = [position.location, position.department, position.workMode].filter(value => !!value).join(CONTEXT_SEPARATOR);

  return { url: position.url, text: position.title, context };
}

/**
 * A position with the role family and level the LLM read, and its place where the board gave none
 *
 * @param {IListedPosition} position
 * @param {IListedPosition} reading
 *
 * @returns {IListedPosition}
 */
function mergeReading(position: IListedPosition, reading: IListedPosition): IListedPosition {
  return {
    ...position,
    country: position.country ?? reading.country,
    city: position.city ?? reading.city,
    workMode: position.workMode ?? reading.workMode,
    roleFamily: reading.roleFamily,
    level: reading.level
  };
}
