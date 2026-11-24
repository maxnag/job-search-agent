import { setTimeout as sleep } from 'node:timers/promises';

import { type DeepMocked, createMock } from '@golevelup/ts-vitest';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ATSKindEnum, RoleFamilyEnum, SourceCandidateStatusEnum, WorkModeEnum } from '@job-agent/shared';

import { createConfigMock } from '../../../../test/config-service.mock.js';
import type { IATSListing, IATSPosition } from '../../ats/interfaces/a-t-s-client.interface.js';
import type { IProfilePreferencesEntry } from '../../search/interfaces/profile-preferences-entry.interface.js';
import type { SourceRowType } from '../../search/interfaces/source-row.interface.js';
import { SourceRepository } from '../../search/repositories/source.repository.js';
import { ATSListingService } from '../../search/services/a-t-s-listing.service.js';
import { ProfilePreferencesService } from '../../search/services/profile-preferences.service.js';
import { PipelineEventsService } from '../../vacancies/services/pipeline-events.service.js';
import { BraveSearchClient } from '../clients/brave-search.client.js';
import { DiscoveryStageEnum } from '../enums/discovery-stage.enum.js';
import type { SourceCandidateRowType } from '../interfaces/source-candidate-row.interface.js';
import { SourceCandidateRepository } from '../repositories/source-candidate.repository.js';
import { DiscoveryOrchestrator } from './discovery.orchestrator.js';

vi.mock('node:timers/promises', () => ({ setTimeout: vi.fn(() => Promise.resolve()) }));

const DAY_MS = 86_400_000;

const PROFILE: IProfilePreferencesEntry = {
  name: 'developer',
  preferences: {
    role_families: [RoleFamilyEnum.BACKEND],
    places: [{ country: 'IL', work_modes: [WorkModeEnum.HYBRID], excluded_cities: [] }],
    excluded_companies: []
  }
};

const NORTHWIND = 'https://job-boards.greenhouse.io/northwind/jobs/1';

const CONTOSO = 'https://jobs.lever.co/Contoso/a1';

const FABRIKAM = 'https://www.comeet.com/jobs/fabrikam/A1.00B/backend/C2.D41';

/**
 * A position of a board
 *
 * @param {string} title
 * @param {Partial<IATSPosition>} changes
 *
 * @returns {IATSPosition}
 */
function position(title: string, changes: Partial<IATSPosition> = {}): IATSPosition {
  return {
    externalId: title,
    url: `https://example.com/${title}`,
    title,
    country: 'IL',
    city: 'Haifa',
    workMode: WorkModeEnum.HYBRID,
    location: 'Haifa',
    department: null,
    ...changes
  };
}

/**
 * A known candidate row
 *
 * @param {Partial<SourceCandidateRowType>} changes
 *
 * @returns {SourceCandidateRowType}
 */
function candidate(changes: Partial<SourceCandidateRowType>): SourceCandidateRowType {
  return {
    source_candidate_id: 1,
    source_candidate_ats_kind: ATSKindEnum.LEVER,
    source_candidate_board: 'Contoso',
    source_candidate_status: SourceCandidateStatusEnum.IGNORED,
    source_candidate_checked_at: new Date(),
    ...changes
  } as SourceCandidateRowType;
}

describe('DiscoveryOrchestrator (unit)', () => {
  let moduleFixture: TestingModule;
  let subjectUnderTest: DiscoveryOrchestrator;
  let brave: DeepMocked<BraveSearchClient>;
  let listings: DeepMocked<ATSListingService>;
  let preferences: DeepMocked<ProfilePreferencesService>;
  let events: DeepMocked<PipelineEventsService>;
  let candidates: DeepMocked<SourceCandidateRepository>;
  let sources: DeepMocked<SourceRepository>;
  let env: Record<string, unknown>;

  beforeEach(async () => {
    brave = createMock<BraveSearchClient>();
    listings = createMock<ATSListingService>();
    preferences = createMock<ProfilePreferencesService>();
    events = createMock<PipelineEventsService>();
    candidates = createMock<SourceCandidateRepository>();
    sources = createMock<SourceRepository>();
    env = { DISCOVER_MAX_QUERIES: 1, DISCOVER_RECHECK_DAYS: 30, DISCOVER_BOARD_TIMEOUT_MS: 8000, DISCOVER_MAX_CARDS: 10 };
    preferences.findAll.mockResolvedValue([PROFILE]);
    brave.search.mockResolvedValue([NORTHWIND]);
    sources.findAll.mockResolvedValue([]);
    candidates.findAll.mockResolvedValue([]);
    candidates.upsert.mockImplementation(values => Promise.resolve({ ...candidate({}), ...values, source_candidate_id: 40 }));
    candidates.countOpenCards.mockResolvedValue(0);
    candidates.findUnnotified.mockResolvedValue([]);
    listings.fetchBoard.mockResolvedValue({ company: 'Northwind', positions: [position('Backend Engineer')] });
    listings.passingPositions.mockImplementation((listing: IATSListing) =>
      listing.positions.filter(item => item.title.includes('Backend'))
    );
    moduleFixture = await Test.createTestingModule({
      providers: [
        DiscoveryOrchestrator,
        { provide: BraveSearchClient, useValue: brave },
        { provide: ATSListingService, useValue: listings },
        { provide: ProfilePreferencesService, useValue: preferences },
        { provide: PipelineEventsService, useValue: events },
        { provide: SourceCandidateRepository, useValue: candidates },
        { provide: SourceRepository, useValue: sources },
        { provide: ConfigService, useValue: createConfigMock(new Proxy({}, { get: (_target, key: string) => env[key] })) }
      ]
    }).compile();

    subjectUnderTest = moduleFixture.get(DiscoveryOrchestrator);
  });

  afterEach(async () => {
    await moduleFixture.close();
    vi.restoreAllMocks();
    vi.mocked(sleep).mockClear();
  });

  it('should be defined', () => {
    expect(subjectUnderTest).toBeDefined();
  });

  describe('isEnabled', () => {
    it.each([true, false])('follows the search client: %s', enabled => {
      brave.isEnabled.mockReturnValue(enabled);

      expect(subjectUnderTest.isEnabled()).toBe(enabled);
    });
  });

  describe('discover', () => {
    it('stores a new board with its counts and examples, and returns it in the summary', async () => {
      listings.fetchBoard.mockResolvedValue({
        company: ' Northwind ',
        positions: [
          position('Backend Engineer'),
          position('Backend Lead', { location: null }),
          position('Backend Architect'),
          position('Senior Backend'),
          position('Designer'),
          position('Backend Remote', { country: null, location: 'Somewhere' })
        ]
      });

      const summary = await subjectUnderTest.discover(false);

      expect(brave.search).toHaveBeenCalledWith('site:comeet.com/jobs Israel "backend"');
      expect(listings.fetchBoard).toHaveBeenCalledWith({ kind: ATSKindEnum.GREENHOUSE, board: 'northwind' }, 8000);
      expect(candidates.upsert).toHaveBeenCalledWith({
        source_candidate_ats_kind: ATSKindEnum.GREENHOUSE,
        source_candidate_board: 'northwind',
        source_candidate_company: 'Northwind',
        source_candidate_status: SourceCandidateStatusEnum.PROPOSED,
        source_candidate_positions: 6,
        source_candidate_matching: 4,
        source_candidate_unknown: 1,
        source_candidate_examples: ['Backend Engineer — Haifa', 'Backend Lead', 'Backend Architect — Haifa']
      });
      expect(summary).toEqual({
        queries: 1,
        boards: 1,
        known: 0,
        failed: 0,
        cards: 0,
        discovered: [
          {
            kind: ATSKindEnum.GREENHOUSE,
            board: 'northwind',
            company: 'Northwind',
            positions: 6,
            matching: 4,
            unknown: 1,
            status: SourceCandidateStatusEnum.PROPOSED,
            candidateId: 40
          }
        ]
      });
    });

    it('stores a board where nothing passes as empty, named after the board when the system gives no company', async () => {
      listings.fetchBoard.mockResolvedValue({ company: null, positions: [position('Designer')] });

      const summary = await subjectUnderTest.discover(false);

      expect(summary.discovered[0]).toEqual(
        expect.objectContaining({ company: 'northwind', matching: 0, status: SourceCandidateStatusEnum.EMPTY })
      );
      expect(candidates.upsert).toHaveBeenCalledWith(expect.objectContaining({ source_candidate_examples: [] }));
    });

    it('stores nothing and queues no card on a dry run', async () => {
      const summary = await subjectUnderTest.discover(true);

      expect(candidates.upsert).not.toHaveBeenCalled();
      expect(candidates.countOpenCards).not.toHaveBeenCalled();
      expect(events.sourceCandidateProposed).not.toHaveBeenCalled();
      expect(summary.cards).toBe(0);
      expect(summary.discovered[0]).not.toHaveProperty('candidateId');
    });

    it('reads one board once, whatever the links and queries that lead to it', async () => {
      env['DISCOVER_MAX_QUERIES'] = 2;
      brave.search.mockResolvedValue([NORTHWIND, 'https://boards.greenhouse.io/Northwind', 'https://careers.example.com/jobs']);

      const summary = await subjectUnderTest.discover(true);

      expect(summary.boards).toBe(1);
      expect(listings.fetchBoard).toHaveBeenCalledTimes(1);
    });

    it('pauses between search queries, not before the first', async () => {
      env['DISCOVER_MAX_QUERIES'] = 3;

      await subjectUnderTest.discover(true);

      expect(brave.search).toHaveBeenCalledTimes(3);
      expect(sleep).toHaveBeenCalledTimes(2);
      expect(sleep).toHaveBeenCalledWith(1000);
    });

    it('skips the boards of sources and the known candidates, and rechecks an old empty one', async () => {
      brave.search.mockResolvedValue([NORTHWIND, CONTOSO, FABRIKAM, 'https://jobs.lever.co/Litware/b1', 'https://jobs.lever.co/Adatum/c1']);
      sources.findAll.mockResolvedValue([{ source_url: 'https://job-boards.greenhouse.io/northwind' } as SourceRowType]);
      candidates.findAll.mockResolvedValue([
        candidate({ source_candidate_board: 'Contoso', source_candidate_status: SourceCandidateStatusEnum.IGNORED }),
        candidate({ source_candidate_ats_kind: ATSKindEnum.COMEET, source_candidate_board: 'fabrikam-labs/a1.00b' }),
        candidate({
          source_candidate_board: 'Litware',
          source_candidate_status: SourceCandidateStatusEnum.EMPTY,
          source_candidate_checked_at: new Date(Date.now() - 31 * DAY_MS)
        }),
        candidate({
          source_candidate_board: 'Adatum',
          source_candidate_status: SourceCandidateStatusEnum.EMPTY,
          source_candidate_checked_at: new Date(Date.now() - 29 * DAY_MS)
        })
      ]);

      const summary = await subjectUnderTest.discover(true);

      expect(summary.boards).toBe(5);
      expect(summary.known).toBe(4);
      expect(listings.fetchBoard).toHaveBeenCalledTimes(1);
      expect(listings.fetchBoard).toHaveBeenCalledWith({ kind: ATSKindEnum.LEVER, board: 'Litware' }, 8000);
    });

    it('counts a board that cannot be read as failed and goes on with the others', async () => {
      const debugSpy = vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);

      brave.search.mockResolvedValue([NORTHWIND, 'https://job-boards.greenhouse.io/tailspin/jobs/2']);
      listings.fetchBoard.mockRejectedValueOnce(new Error('HTTP 404')).mockResolvedValueOnce({ company: 'Tailspin', positions: [] });

      const summary = await subjectUnderTest.discover(true);

      expect(summary.failed).toBe(1);
      expect(summary.discovered.map(board => board.board)).toEqual(['tailspin']);
      expect(debugSpy).toHaveBeenCalledWith(expect.objectContaining({ message: 'Board not read', board: 'northwind', reason: 'HTTP 404' }));
    });

    it('warns about a failed search query and goes on', async () => {
      const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

      env['DISCOVER_MAX_QUERIES'] = 2;
      brave.search.mockRejectedValueOnce(new Error('BRAVE_SEARCH_FAILED: HTTP 500')).mockResolvedValueOnce([NORTHWIND]);

      const summary = await subjectUnderTest.discover(true);

      expect(summary.boards).toBe(1);
      expect(warnSpy).toHaveBeenCalledWith({ message: 'Search query failed', reason: 'BRAVE_SEARCH_FAILED: HTTP 500' });
    });

    it.each(['BRAVE_SEARCH_DISABLED', 'BRAVE_SEARCH_UNAUTHORIZED', 'BRAVE_SEARCH_RATE_LIMITED'])(
      'stops the whole run on %s',
      async code => {
        brave.search.mockRejectedValue(new Error(`${code}: reason`));

        await expect(subjectUnderTest.discover(false)).rejects.toThrow(code);
        expect(listings.fetchBoard).not.toHaveBeenCalled();
      }
    );

    it('reports progress per query and per board', async () => {
      const progress = vi.fn();

      await subjectUnderTest.discover(true, progress);

      expect(progress.mock.calls).toEqual([
        [{ stage: DiscoveryStageEnum.QUERY, done: 1, total: 1 }],
        [{ stage: DiscoveryStageEnum.BOARD, done: 1, total: 1, board: 'greenhouse northwind' }]
      ]);
    });

    it('queues cards for unnotified candidates up to the room left and marks them', async () => {
      candidates.countOpenCards.mockResolvedValue(7);
      candidates.findUnnotified.mockResolvedValue([candidate({ source_candidate_id: 3 }), candidate({ source_candidate_id: 4 })]);

      const summary = await subjectUnderTest.discover(false);

      expect(candidates.findUnnotified).toHaveBeenCalledWith(3);
      expect(events.sourceCandidateProposed.mock.calls).toEqual([[{ sourceCandidateId: 3 }], [{ sourceCandidateId: 4 }]]);
      expect(candidates.markNotified).toHaveBeenCalledWith([3, 4]);
      expect(summary.cards).toBe(2);
    });

    it.each([10, 12])('queues no card when %i cards are open', async open => {
      candidates.countOpenCards.mockResolvedValue(open);

      const summary = await subjectUnderTest.discover(false);

      expect(candidates.findUnnotified).not.toHaveBeenCalled();
      expect(candidates.markNotified).not.toHaveBeenCalled();
      expect(summary.cards).toBe(0);
    });
  });
});
