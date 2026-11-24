import { setTimeout as sleep } from 'node:timers/promises';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { SourceCandidateStatusEnum } from '@job-agent/shared';

import type { IEnv } from '../../../config/env.schema.js';
import { boardIdentity, parseATSBoard } from '../../ats/helpers/a-t-s-board.helper.js';
import type { IATSBoard } from '../../ats/interfaces/a-t-s-board.interface.js';
import type { IProfilePreferencesEntry } from '../../search/interfaces/profile-preferences-entry.interface.js';
import { SourceRepository } from '../../search/repositories/source.repository.js';
import { ATSListingService } from '../../search/services/a-t-s-listing.service.js';
import { ProfilePreferencesService } from '../../search/services/profile-preferences.service.js';
import { VACANCY_FIELD_LIMITS, clipText } from '../../vacancies/helpers/vacancy-fields.helper.js';
import { PipelineEventsService } from '../../vacancies/services/pipeline-events.service.js';
import { BraveSearchClient } from '../clients/brave-search.client.js';
import { DiscoveryStageEnum } from '../enums/discovery-stage.enum.js';
import { buildDiscoveryQueries } from '../helpers/discovery-query.helper.js';
import { positionPlaces } from '../helpers/position-place.helper.js';
import type { IDiscoveryProgress } from '../interfaces/discovery-progress.interface.js';
import type { IDiscoveredBoard, IDiscoverySummary } from '../interfaces/discovery-summary.interface.js';
import type { SourceCandidateRowType } from '../interfaces/source-candidate-row.interface.js';
import { SourceCandidateRepository } from '../repositories/source-candidate.repository.js';

/**
 * Pause between two web search queries
 *
 * @type {number}
 */
const QUERY_PAUSE_MS = 1000;

/**
 * Positions of a proposed board shown on its card
 *
 * @type {number}
 */
const CARD_EXAMPLES = 3;

/**
 * Milliseconds in a day
 *
 * @type {number}
 */
const DAY_MS = 86_400_000;

/**
 * Search errors after which no later query can succeed — the run stops
 *
 * @type {readonly string[]}
 */
const FATAL_SEARCH_CODES: readonly string[] = ['BRAVE_SEARCH_DISABLED', 'BRAVE_SEARCH_UNAUTHORIZED', 'BRAVE_SEARCH_RATE_LIMITED'];

/**
 * What reading the boards of one system shares: the profiles, the dry-run switch, the progress
 */
interface IBoardCheck {
  /**
   * Preferences of every profile
   *
   * @var {readonly IProfilePreferencesEntry[]}
   */
  readonly profiles: readonly IProfilePreferencesEntry[];

  /**
   * True when nothing is stored
   *
   * @var {boolean}
   */
  readonly dryRun: boolean;

  /**
   * Boards read so far across the systems, and in all
   *
   * @var {{ done: number; total: number }}
   */
  readonly counter: { done: number; readonly total: number };

  /**
   * Told after every board
   *
   * @var {((progress: IDiscoveryProgress) => void) | undefined}
   */
  readonly onProgress?: (progress: IDiscoveryProgress) => void;
}

/**
 * Finds company boards on applicant tracking systems: web search queries built from the profiles, the result URLs
 * reduced to boards by code — no LLM, nothing of the search kept — each new board read once and stored as a candidate
 * with how many of its positions the profiles want by company and place. The owner decides which become sources
 */
@Injectable()
export class DiscoveryOrchestrator {
  /**
   * Logger
   *
   * @var {Logger}
   */
  private readonly logger = new Logger(DiscoveryOrchestrator.name);

  /**
   * @param {BraveSearchClient} braveSearchClient
   * @param {ATSListingService} atsListingService
   * @param {ProfilePreferencesService} profilePreferencesService
   * @param {PipelineEventsService} pipelineEventsService
   * @param {SourceCandidateRepository} sourceCandidateRepository
   * @param {SourceRepository} sourceRepository
   * @param {ConfigService<IEnv, true>} configService
   */
  constructor(
    private readonly braveSearchClient: BraveSearchClient,
    private readonly atsListingService: ATSListingService,
    private readonly profilePreferencesService: ProfilePreferencesService,
    private readonly pipelineEventsService: PipelineEventsService,
    private readonly sourceCandidateRepository: SourceCandidateRepository,
    private readonly sourceRepository: SourceRepository,
    private readonly configService: ConfigService<IEnv, true>
  ) {}

  /**
   * True when the web search is configured
   *
   * @returns {boolean}
   */
  isEnabled(): boolean {
    return this.braveSearchClient.isEnabled();
  }

  /**
   * One discovery run; a dry run reads the boards and stores nothing. The boards of each applicant tracking system are
   * read one after another, the systems side by side — every site still gets one request at a time. At the end cards
   * of proposed boards not offered yet are queued, the most matching first, so that at most `DISCOVER_MAX_CARDS` wait
   * for the owner's decision
   *
   * @param {boolean} dryRun
   * @param {(progress: IDiscoveryProgress) => void} [onProgress] Told after every query and every board
   *
   * @throws {Error} `BRAVE_SEARCH_DISABLED`, `BRAVE_SEARCH_UNAUTHORIZED` or `BRAVE_SEARCH_RATE_LIMITED` — the run stops
   * @throws {Error} `PROFILE_PREFERENCES_INVALID` or a database error
   *
   * @returns {Promise<IDiscoverySummary>}
   */
  async discover(dryRun: boolean, onProgress?: (progress: IDiscoveryProgress) => void): Promise<IDiscoverySummary> {
    const profiles = await this.profilePreferencesService.findAll();
    const queries = buildDiscoveryQueries(profiles, this.configService.get('DISCOVER_MAX_QUERIES', { infer: true }));
    const boards = await this.searchBoards(queries, onProgress);
    const fresh = await this.newBoards(boards);
    const counter = { done: 0, total: fresh.length };
    const groups = [...Map.groupBy(fresh, board => board.kind).values()];
    const results = await Promise.allSettled(
      groups.map(async group => this.checkGroup(group, { profiles, dryRun, counter, ...(onProgress ? { onProgress } : {}) }))
    );
    const outcomes = results.flatMap(result => (result.status === 'fulfilled' ? result.value : []));
    const discovered = outcomes.filter(outcome => outcome !== undefined);
    const failed = fresh.length - discovered.length;
    const cards = dryRun ? 0 : await this.queueCards();
    const summary = { queries: queries.length, boards: boards.length, known: boards.length - fresh.length, failed, cards, discovered };

    this.logger.log({
      message: 'Discovery finished',
      dryRun,
      queries: summary.queries,
      boards: summary.boards,
      known: summary.known,
      failed,
      proposed: discovered.filter(board => board.status === SourceCandidateStatusEnum.PROPOSED).length,
      cards
    });

    return summary;
  }

  /**
   * Distinct boards among the results of every query; a failed query is skipped, unless no later one can succeed
   *
   * @param {readonly string[]} queries
   * @param {(progress: IDiscoveryProgress) => void} [onProgress]
   *
   * @throws {Error} `BRAVE_SEARCH_DISABLED`, `BRAVE_SEARCH_UNAUTHORIZED` or `BRAVE_SEARCH_RATE_LIMITED`
   *
   * @returns {Promise<IATSBoard[]>}
   */
  private async searchBoards(queries: readonly string[], onProgress?: (progress: IDiscoveryProgress) => void): Promise<IATSBoard[]> {
    const boards = new Map<string, IATSBoard>();

    for (const [index, query] of queries.entries()) {
      if (index > 0) {
        await sleep(QUERY_PAUSE_MS);
      }

      for (const board of await this.searchQuery(query)) {
        if (!boards.has(boardIdentity(board))) {
          boards.set(boardIdentity(board), board);
        }
      }

      onProgress?.({ stage: DiscoveryStageEnum.QUERY, done: index + 1, total: queries.length });
    }

    return [...boards.values()];
  }

  /**
   * Boards among the results of one query
   *
   * @param {string} query
   *
   * @throws {Error} `BRAVE_SEARCH_DISABLED`, `BRAVE_SEARCH_UNAUTHORIZED` or `BRAVE_SEARCH_RATE_LIMITED`
   *
   * @returns {Promise<IATSBoard[]>}
   */
  private async searchQuery(query: string): Promise<IATSBoard[]> {
    try {
      return (await this.braveSearchClient.search(query)).map(url => parseATSBoard(url)).filter(board => board !== undefined);
    } catch (error) {
      const message = (error as Error).message;

      if (FATAL_SEARCH_CODES.some(code => message.startsWith(`${code}:`))) {
        throw error;
      }

      this.logger.warn({ message: 'Search query failed', reason: message });

      return [];
    }
  }

  /**
   * Boards that are neither a source nor a candidate, compared by `boardIdentity` — a Comeet board under another slug
   * is the same board. A candidate with no matching position counts as new again once `DISCOVER_RECHECK_DAYS` have
   * passed since its check
   *
   * @param {readonly IATSBoard[]} boards
   *
   * @returns {Promise<IATSBoard[]>}
   */
  private async newBoards(boards: readonly IATSBoard[]): Promise<IATSBoard[]> {
    const [sources, candidates] = await Promise.all([this.sourceRepository.findAll(), this.sourceCandidateRepository.findAll()]);
    const sourceBoards = new Set(
      sources
        .map(source => parseATSBoard(source.source_url))
        .filter(board => board !== undefined)
        .map(board => boardIdentity(board))
    );
    const candidateBoards = new Map(
      candidates.map(row => [boardIdentity({ kind: row.source_candidate_ats_kind, board: row.source_candidate_board }), row])
    );
    const recheckBefore = Date.now() - this.configService.get('DISCOVER_RECHECK_DAYS', { infer: true }) * DAY_MS;

    return boards.filter(board => {
      const identity = boardIdentity(board);
      const candidate = candidateBoards.get(identity);

      return !sourceBoards.has(identity) && (!candidate || isDueForRecheck(candidate, recheckBefore));
    });
  }

  /**
   * Read the boards of one applicant tracking system one after another; a board not read is `undefined`
   *
   * @param {readonly IATSBoard[]} group
   * @param {IBoardCheck} check
   *
   * @returns {Promise<(IDiscoveredBoard | undefined)[]>}
   */
  private async checkGroup(group: readonly IATSBoard[], check: IBoardCheck): Promise<(IDiscoveredBoard | undefined)[]> {
    const outcomes: (IDiscoveredBoard | undefined)[] = [];

    for (const board of group) {
      try {
        outcomes.push(await this.checkBoard(board, check));
      } catch (error) {
        outcomes.push(undefined);
        this.logger.debug({ message: 'Board not read', kind: board.kind, board: board.board, reason: (error as Error).message });
      }

      check.counter.done++;
      check.onProgress?.({
        stage: DiscoveryStageEnum.BOARD,
        done: check.counter.done,
        total: check.counter.total,
        board: `${board.kind} ${board.board}`
      });
    }

    return outcomes;
  }

  /**
   * Read a board, count the positions the profiles want and store the candidate. Only positions whose place is known
   * may count as wanted (`positionPlaces`): the country from the field or the location text, and the work mode where
   * it matters; the rest are counted as unknown
   *
   * @param {IATSBoard} board
   * @param {IBoardCheck} check
   *
   * @throws {CrawlError} If the board was not read
   * @throws {Error} `ATS_RESPONSE_INVALID` if its answer does not match the schema
   *
   * @returns {Promise<IDiscoveredBoard>}
   */
  private async checkBoard(board: IATSBoard, check: IBoardCheck): Promise<IDiscoveredBoard> {
    const listing = await this.atsListingService.fetchBoard(board, this.configService.get('DISCOVER_BOARD_TIMEOUT_MS', { infer: true }));
    const company = clipText(listing.company?.trim() || board.board, VACANCY_FIELD_LIMITS.company);
    const places = positionPlaces(listing.positions, check.profiles);
    const passing = this.atsListingService.passingPositions({ ...listing, positions: places.known }, company, check.profiles);
    const matching = passing.length;
    const status = matching > 0 ? SourceCandidateStatusEnum.PROPOSED : SourceCandidateStatusEnum.EMPTY;
    const discovered = {
      kind: board.kind,
      board: board.board,
      company,
      positions: listing.positions.length,
      matching,
      unknown: places.unknown,
      status
    };

    if (check.dryRun) {
      return discovered;
    }

    const row = await this.sourceCandidateRepository.upsert({
      source_candidate_ats_kind: board.kind,
      source_candidate_board: board.board,
      source_candidate_company: company,
      source_candidate_status: status,
      source_candidate_positions: discovered.positions,
      source_candidate_matching: matching,
      source_candidate_unknown: places.unknown,
      source_candidate_examples: passing
        .slice(0, CARD_EXAMPLES)
        .map(position => [position.title, position.location].filter(value => !!value).join(' — '))
    });

    this.logger.debug({ message: 'Board checked', candidateId: row.source_candidate_id, kind: board.kind, status, matching });

    return { ...discovered, candidateId: row.source_candidate_id };
  }

  /**
   * Queue the cards of the proposed boards not offered yet, the most matching first, up to `DISCOVER_MAX_CARDS` cards
   * waiting for a decision — the cards still open count, however many runs queued them
   *
   * @returns {Promise<number>} The number of cards queued
   */
  private async queueCards(): Promise<number> {
    const room = this.configService.get('DISCOVER_MAX_CARDS', { infer: true }) - (await this.sourceCandidateRepository.countOpenCards());

    if (room <= 0) {
      return 0;
    }

    const candidates = await this.sourceCandidateRepository.findUnnotified(room);

    for (const candidate of candidates) {
      await this.pipelineEventsService.sourceCandidateProposed({ sourceCandidateId: candidate.source_candidate_id });
    }

    await this.sourceCandidateRepository.markNotified(candidates.map(candidate => candidate.source_candidate_id));

    return candidates.length;
  }
}

/**
 * True for a candidate with no matching position whose last check is older than `recheckBefore`
 *
 * @param {SourceCandidateRowType} candidate
 * @param {number} recheckBefore
 *
 * @returns {boolean}
 */
function isDueForRecheck(candidate: SourceCandidateRowType, recheckBefore: number): boolean {
  return (
    candidate.source_candidate_status === SourceCandidateStatusEnum.EMPTY && candidate.source_candidate_checked_at.getTime() < recheckBefore
  );
}
