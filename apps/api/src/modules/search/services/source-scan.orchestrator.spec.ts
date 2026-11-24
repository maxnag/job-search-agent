import { type DeepMocked, createMock } from '@golevelup/ts-vitest';
import { getQueueToken } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import type { Queue } from 'bullmq';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  JobNameEnum,
  QueueNameEnum,
  RoleFamilyEnum,
  SeniorityLevelEnum,
  SourceFetchModeEnum,
  SourceStatusEnum,
  VacancyStageEnum,
  WorkModeEnum
} from '@job-agent/shared';

import { createConfigMock } from '../../../../test/config-service.mock.js';
import { CrawlErrorCodeEnum } from '../../crawler/enums/crawl-error-code.enum.js';
import { CrawlError } from '../../crawler/errors/crawl.error.js';
import type { VacancyRowType } from '../../vacancies/interfaces/vacancy-row.interface.js';
import { VacancyRepository } from '../../vacancies/repositories/vacancy.repository.js';
import { PipelineEventsService } from '../../vacancies/services/pipeline-events.service.js';
import { ListingGapEnum } from '../enums/listing-gap.enum.js';
import { SourceScanOutcomeEnum } from '../enums/source-scan-outcome.enum.js';
import type { IListedPosition } from '../interfaces/listed-position.interface.js';
import type { IListingLinks } from '../interfaces/listing-links.interface.js';
import type { SourceRowType } from '../interfaces/source-row.interface.js';
import { SourceRepository } from '../repositories/source.repository.js';
import { ATSListingService } from './a-t-s-listing.service.js';
import { ListingExtractionService } from './listing-extraction.service.js';
import { ListingPagesService } from './listing-pages.service.js';
import { ProfilePreferencesService } from './profile-preferences.service.js';
import { SourceScanOrchestrator } from './source-scan.orchestrator.js';

const SOURCE = {
  source_id: 1,
  source_name: 'Northwind',
  source_url: 'https://careers.example.com/jobs',
  source_fetch_mode: SourceFetchModeEnum.HTML,
  source_is_active: true,
  source_status: SourceStatusEnum.OK
} as SourceRowType;

const LISTING: IListingLinks = {
  url: SOURCE.source_url,
  pages: 2,
  candidates: [{ url: 'https://careers.example.com/jobs/1', text: 'Backend Developer', context: '' }],
  gaps: []
};

const BACKEND: IListedPosition = {
  url: 'https://careers.example.com/jobs/1',
  title: 'Backend Developer',
  company: 'Northwind',
  country: 'IL',
  city: 'Haifa',
  workMode: WorkModeEnum.HYBRID,
  roleFamily: RoleFamilyEnum.BACKEND,
  level: SeniorityLevelEnum.SENIOR
};

const QA: IListedPosition = { ...BACKEND, url: 'https://careers.example.com/jobs/2', title: 'QA Engineer', roleFamily: RoleFamilyEnum.QA };

describe('SourceScanOrchestrator (unit)', () => {
  let moduleFixture: TestingModule;
  let subjectUnderTest: SourceScanOrchestrator;
  let pages: DeepMocked<ListingPagesService>;
  let listing: DeepMocked<ListingExtractionService>;
  let preferences: DeepMocked<ProfilePreferencesService>;
  let events: DeepMocked<PipelineEventsService>;
  let sources: DeepMocked<SourceRepository>;
  let vacancies: DeepMocked<VacancyRepository>;
  let queue: DeepMocked<Queue>;
  let atsListing: DeepMocked<ATSListingService>;

  beforeEach(async () => {
    pages = createMock<ListingPagesService>();
    listing = createMock<ListingExtractionService>();
    preferences = createMock<ProfilePreferencesService>();
    events = createMock<PipelineEventsService>();
    sources = createMock<SourceRepository>();
    vacancies = createMock<VacancyRepository>();
    queue = createMock<Queue>();
    atsListing = createMock<ATSListingService>();
    sources.findOne.mockResolvedValue(SOURCE);
    pages.read.mockResolvedValue(LISTING);
    listing.extract.mockResolvedValue({ pages: 2, links: 3, positions: [BACKEND, QA], gaps: [] });
    preferences.findAll.mockResolvedValue([
      { name: 'developer', preferences: { role_families: [RoleFamilyEnum.BACKEND], places: [], excluded_companies: [] } }
    ]);
    vacancies.findKnown.mockResolvedValue([]);
    vacancies.findOpenBySource.mockResolvedValue([]);
    vacancies.applyScan.mockResolvedValue({
      created: [
        { vacancyId: 10, stage: VacancyStageEnum.LISTED },
        { vacancyId: 11, stage: VacancyStageEnum.SKIPPED }
      ],
      updated: [],
      closedIds: []
    });
    moduleFixture = await Test.createTestingModule({
      providers: [
        SourceScanOrchestrator,
        { provide: ListingPagesService, useValue: pages },
        { provide: ListingExtractionService, useValue: listing },
        { provide: ATSListingService, useValue: atsListing },
        { provide: ProfilePreferencesService, useValue: preferences },
        { provide: PipelineEventsService, useValue: events },
        { provide: SourceRepository, useValue: sources },
        { provide: VacancyRepository, useValue: vacancies },
        { provide: getQueueToken(QueueNameEnum.SEARCH), useValue: queue },
        { provide: ConfigService, useValue: createConfigMock({ SEARCH_JITTER_MINUTES: 10, VACANCY_RECHECK_HOURS: 24 }) }
      ]
    }).compile();

    subjectUnderTest = moduleFixture.get(SourceScanOrchestrator);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await moduleFixture.close();
  });

  it('should be defined', () => {
    expect(subjectUnderTest).toBeDefined();
  });

  describe('queueScans', () => {
    it('queues one deduplicated scan per scannable source, each with a jitter within the window', async () => {
      sources.findScannable.mockResolvedValue([SOURCE, { ...SOURCE, source_id: 2 }]);

      await expect(subjectUnderTest.queueScans()).resolves.toBe(2);

      for (const [index, sourceId] of [1, 2].entries()) {
        const [name, data, options] = queue.add.mock.calls[index] ?? [];

        expect([name, data]).toEqual([JobNameEnum.SCAN_SOURCE, { sourceId }]);
        expect(options?.deduplication).toEqual({ id: `${JobNameEnum.SCAN_SOURCE}:${sourceId}` });
        expect(options?.delay).toBeGreaterThanOrEqual(0);
        expect(options?.delay).toBeLessThanOrEqual(600_000);
      }
    });

    it('queues nothing without scannable sources', async () => {
      sources.findScannable.mockResolvedValue([]);

      await expect(subjectUnderTest.queueScans()).resolves.toBe(0);
      expect(queue.add).not.toHaveBeenCalled();
    });
  });

  describe('queueScan', () => {
    it('queues the scan of one source now, deduplicated', async () => {
      await subjectUnderTest.queueScan(7);

      expect(queue.add).toHaveBeenCalledWith(
        JobNameEnum.SCAN_SOURCE,
        { sourceId: 7 },
        { deduplication: { id: `${JobNameEnum.SCAN_SOURCE}:7` } }
      );
    });
  });

  describe('scan — a board of an applicant tracking system', () => {
    const ATS_SOURCE = { ...SOURCE, source_url: 'https://job-boards.greenhouse.io/northwind', source_fetch_mode: SourceFetchModeEnum.ATS };
    const BOARD = { company: 'Northwind', positions: [] };

    beforeEach(() => {
      sources.findOne.mockResolvedValue(ATS_SOURCE);
      atsListing.fetch.mockResolvedValue(BOARD);
      atsListing.classify.mockResolvedValue({ pages: 1, links: 2, positions: [BACKEND, QA], gaps: [] });
    });

    it('reads the board through its API, classifies it with the profiles and writes the plan — no page is fetched', async () => {
      await expect(subjectUnderTest.scan({ sourceId: 1 })).resolves.toMatchObject({
        outcome: SourceScanOutcomeEnum.SCANNED,
        pages: 1,
        links: 2,
        positions: 2
      });

      expect(atsListing.fetch).toHaveBeenCalledWith(ATS_SOURCE);
      expect(atsListing.classify).toHaveBeenCalledWith(ATS_SOURCE, BOARD, [expect.objectContaining({ name: 'developer' })]);
      expect(pages.read).not.toHaveBeenCalled();
      expect(listing.extract).not.toHaveBeenCalled();
      expect(sources.markScanned).toHaveBeenCalledWith(1);
    });

    it('stops the source when the system refuses the crawler, and tells the owner', async () => {
      atsListing.fetch.mockRejectedValue(new CrawlError(CrawlErrorCodeEnum.SOURCE_BLOCKED, 'boards-api.greenhouse.io'));

      await expect(subjectUnderTest.scan({ sourceId: 1 })).resolves.toMatchObject({ outcome: SourceScanOutcomeEnum.BLOCKED });
      expect(sources.markFailed).toHaveBeenCalledWith(
        1,
        `${CrawlErrorCodeEnum.SOURCE_BLOCKED}: boards-api.greenhouse.io`,
        SourceStatusEnum.BLOCKED
      );
      expect(events.sourceBlocked).toHaveBeenCalledWith(1);
      expect(atsListing.classify).not.toHaveBeenCalled();
    });

    it.each(['ATS_RESPONSE_INVALID: Greenhouse board northwind does not match the schema', 'SOURCE_URL_NOT_ATS: source 1'])(
      'records %j as the failure of the source and passes it on',
      async message => {
        atsListing.fetch.mockRejectedValue(new Error(message));

        await expect(subjectUnderTest.scan({ sourceId: 1 })).rejects.toThrow(message);
        expect(sources.markFailed).toHaveBeenCalledWith(1, message);
        expect(events.sourceBlocked).not.toHaveBeenCalled();
      }
    );
  });

  describe('scan', () => {
    it('fetches the listing, screens the positions by the profiles, writes the plan and queues the listed ones', async () => {
      const summary = await subjectUnderTest.scan({ sourceId: 1 });

      expect(pages.read).toHaveBeenCalledWith(SOURCE.source_url, SourceFetchModeEnum.HTML);
      expect(listing.extract).toHaveBeenCalledWith(LISTING, 'Northwind');
      expect(vacancies.findKnown).toHaveBeenCalledWith([BACKEND.url, QA.url], ['northwind|backend developer', 'northwind|qa engineer']);

      const [plan] = vacancies.applyScan.mock.calls[0] ?? [];

      expect(plan?.inserts.map(insert => [insert.vacancy_title, insert.vacancy_stage, insert.vacancy_skip_reason])).toEqual([
        ['Backend Developer', VacancyStageEnum.LISTED, null],
        ['QA Engineer', VacancyStageEnum.SKIPPED, 'role qa is not searched']
      ]);
      expect(events.queueExtraction).toHaveBeenCalledWith([10]);
      expect(events.vacanciesClosed).toHaveBeenCalledWith([]);
      expect(sources.markScanned).toHaveBeenCalledWith(1);
      expect(summary).toEqual({
        sourceId: 1,
        outcome: SourceScanOutcomeEnum.SCANNED,
        pages: 2,
        links: 3,
        positions: 2,
        created: 2,
        skipped: 1,
        closed: 0,
        queued: 1,
        gaps: []
      });
    });

    it('queues extracted vacancies due for a recheck and reports the closed ones', async () => {
      const stale = {
        vacancy_id: 5,
        vacancy_url: BACKEND.url,
        vacancy_dedup_key: 'northwind|backend developer',
        vacancy_stage: VacancyStageEnum.EXTRACTED,
        vacancy_data: { title: 'Backend Developer' },
        vacancy_checked_at: new Date('2020-01-01')
      } as unknown as VacancyRowType;

      vacancies.findKnown.mockResolvedValue([stale]);
      vacancies.applyScan.mockResolvedValue({
        created: [],
        updated: [{ vacancyId: 5, stage: VacancyStageEnum.EXTRACTED }],
        closedIds: [8]
      });

      const summary = await subjectUnderTest.scan({ sourceId: 1 });

      expect(events.queueExtraction).toHaveBeenCalledWith([5]);
      expect(events.vacanciesClosed).toHaveBeenCalledWith([8]);
      expect(summary).toMatchObject({ closed: 1, queued: 1 });
    });

    it('refuses an unknown source', async () => {
      sources.findOne.mockResolvedValue(undefined);

      await expect(subjectUnderTest.scan({ sourceId: 9 })).rejects.toThrow('SOURCE_NOT_FOUND: 9');
    });

    it.each([
      ['switched off', { source_is_active: false }],
      ['stopped by the crawler', { source_status: SourceStatusEnum.BLOCKED }]
    ])('skips a source %s unless forced', async (_case, changes) => {
      sources.findOne.mockResolvedValue({ ...SOURCE, ...changes });

      await expect(subjectUnderTest.scan({ sourceId: 1 })).resolves.toMatchObject({ outcome: SourceScanOutcomeEnum.SKIPPED, links: 0 });
      expect(pages.read).not.toHaveBeenCalled();

      await expect(subjectUnderTest.scan({ sourceId: 1, force: true })).resolves.toMatchObject({ outcome: SourceScanOutcomeEnum.SCANNED });
    });

    it.each([
      [CrawlErrorCodeEnum.ROBOTS_DISALLOWED, SourceStatusEnum.BLOCKED_BY_ROBOTS],
      [CrawlErrorCodeEnum.SOURCE_BLOCKED, SourceStatusEnum.BLOCKED]
    ])('stops the source on %s, tells the owner and yields nothing', async (code, status) => {
      pages.read.mockRejectedValue(new CrawlError(code, 'careers.example.com'));

      await expect(subjectUnderTest.scan({ sourceId: 1 })).resolves.toMatchObject({ outcome: SourceScanOutcomeEnum.BLOCKED });
      expect(sources.markFailed).toHaveBeenCalledWith(1, `${code}: careers.example.com`, status);
      expect(events.sourceBlocked).toHaveBeenCalledWith(1);
      expect(listing.extract).not.toHaveBeenCalled();
    });

    it.each([CrawlErrorCodeEnum.FETCH_FAILED, CrawlErrorCodeEnum.PRIVATE_ADDRESS])(
      'records a %s failure and passes it on, the source keeping its status',
      async code => {
        const failure = new CrawlError(code, 'careers.example.com');

        pages.read.mockRejectedValue(failure);

        await expect(subjectUnderTest.scan({ sourceId: 1 })).rejects.toBe(failure);
        expect(sources.markFailed).toHaveBeenCalledWith(1, failure.message, undefined);
        expect(events.sourceBlocked).not.toHaveBeenCalled();
      }
    );

    it('passes an error that is not a crawl failure on without recording it', async () => {
      pages.read.mockRejectedValue(new TypeError('bug'));

      await expect(subjectUnderTest.scan({ sourceId: 1 })).rejects.toThrow('bug');
      expect(sources.markFailed).not.toHaveBeenCalled();
    });

    it('records a failure after the page was fetched and passes it on', async () => {
      listing.extract.mockRejectedValue(new Error('LLM_OUTPUT_SCHEMA_INVALID: positions'));

      await expect(subjectUnderTest.scan({ sourceId: 1 })).rejects.toThrow('LLM_OUTPUT_SCHEMA_INVALID');
      expect(sources.markFailed).toHaveBeenCalledWith(1, 'LLM_OUTPUT_SCHEMA_INVALID: positions');
      expect(sources.markScanned).not.toHaveBeenCalled();
    });

    it('closes nothing when the page yielded no position although vacancies are open', async () => {
      listing.extract.mockResolvedValue({ pages: 1, links: 40, positions: [], gaps: [] });
      vacancies.findOpenBySource.mockResolvedValue([{ vacancy_id: 5 } as VacancyRowType]);
      vacancies.applyScan.mockResolvedValue({ created: [], updated: [], closedIds: [] });

      await subjectUnderTest.scan({ sourceId: 1 });

      expect(vacancies.applyScan.mock.calls[0]?.[0].closeIds).toEqual([]);
    });

    it('closes nothing on an incomplete listing, rechecks the extracted vacancies not on it, warns and reports the gaps', async () => {
      const unseen = {
        vacancy_id: 8,
        vacancy_url: 'https://careers.example.com/jobs/8',
        vacancy_dedup_key: 'northwind|data engineer',
        vacancy_stage: VacancyStageEnum.EXTRACTED,
        vacancy_data: { title: 'Data Engineer' },
        vacancy_checked_at: null
      } as unknown as VacancyRowType;
      const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

      listing.extract.mockResolvedValue({ pages: 1, links: 3, positions: [BACKEND, QA], gaps: [ListingGapEnum.PAGINATION] });
      vacancies.findOpenBySource.mockResolvedValue([unseen]);

      const summary = await subjectUnderTest.scan({ sourceId: 1 });

      expect(vacancies.applyScan.mock.calls[0]?.[0]).toMatchObject({ closeIds: [], recheckIds: [8] });
      expect(events.queueExtraction).toHaveBeenCalledWith([10, 8]);
      expect(warn).toHaveBeenCalledWith({
        message: 'Listing is incomplete, nothing closed',
        sourceId: 1,
        gaps: [ListingGapEnum.PAGINATION],
        open: 1,
        rechecked: 1
      });
      expect(summary).toMatchObject({ closed: 0, queued: 2, gaps: [ListingGapEnum.PAGINATION] });
    });

    it('warns once, as an empty listing, when an incomplete page yielded no position', async () => {
      const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

      listing.extract.mockResolvedValue({ pages: 1, links: 0, positions: [], gaps: [ListingGapEnum.SCROLL_LIMIT] });
      vacancies.findOpenBySource.mockResolvedValue([{ vacancy_id: 5 } as VacancyRowType]);
      vacancies.applyScan.mockResolvedValue({ created: [], updated: [], closedIds: [] });

      await subjectUnderTest.scan({ sourceId: 1 });

      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(expect.objectContaining({ message: 'Listing has no positions, nothing closed' }));
    });
  });
});
