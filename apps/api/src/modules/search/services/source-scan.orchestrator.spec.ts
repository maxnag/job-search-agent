import { type DeepMocked, createMock } from '@golevelup/ts-vitest';
import { getQueueToken } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import type { Queue } from 'bullmq';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

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
import { CrawlerService } from '../../crawler/services/crawler.service.js';
import type { VacancyRowType } from '../../vacancies/interfaces/vacancy-row.interface.js';
import { VacancyRepository } from '../../vacancies/repositories/vacancy.repository.js';
import { PipelineEventsService } from '../../vacancies/services/pipeline-events.service.js';
import { SourceScanOutcomeEnum } from '../enums/source-scan-outcome.enum.js';
import type { IListedPosition } from '../interfaces/listed-position.interface.js';
import type { SourceRowType } from '../interfaces/source-row.interface.js';
import { SourceRepository } from '../repositories/source.repository.js';
import { ATSListingService } from './a-t-s-listing.service.js';
import { ListingExtractionService } from './listing-extraction.service.js';
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

const PAGE = { url: SOURCE.source_url, status: 200, headers: {}, html: '<a href="/jobs/1">Backend Developer</a>' };

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
  let crawler: DeepMocked<CrawlerService>;
  let listing: DeepMocked<ListingExtractionService>;
  let preferences: DeepMocked<ProfilePreferencesService>;
  let events: DeepMocked<PipelineEventsService>;
  let sources: DeepMocked<SourceRepository>;
  let vacancies: DeepMocked<VacancyRepository>;
  let queue: DeepMocked<Queue>;

  beforeEach(async () => {
    crawler = createMock<CrawlerService>();
    listing = createMock<ListingExtractionService>();
    preferences = createMock<ProfilePreferencesService>();
    events = createMock<PipelineEventsService>();
    sources = createMock<SourceRepository>();
    vacancies = createMock<VacancyRepository>();
    queue = createMock<Queue>();
    sources.findOne.mockResolvedValue(SOURCE);
    crawler.fetchPage.mockResolvedValue(PAGE);
    listing.extract.mockResolvedValue({ links: 3, positions: [BACKEND, QA] });
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
        { provide: CrawlerService, useValue: crawler },
        { provide: ListingExtractionService, useValue: listing },
        { provide: ATSListingService, useValue: {} },
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

  describe('scan', () => {
    it('fetches the listing, screens the positions by the profiles, writes the plan and queues the listed ones', async () => {
      const summary = await subjectUnderTest.scan({ sourceId: 1 });

      expect(crawler.fetchPage).toHaveBeenCalledWith(SOURCE.source_url, SourceFetchModeEnum.HTML);
      expect(listing.extract).toHaveBeenCalledWith(PAGE, 'Northwind');
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
        links: 3,
        positions: 2,
        created: 2,
        skipped: 1,
        closed: 0,
        queued: 1
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
      expect(crawler.fetchPage).not.toHaveBeenCalled();

      await expect(subjectUnderTest.scan({ sourceId: 1, force: true })).resolves.toMatchObject({ outcome: SourceScanOutcomeEnum.SCANNED });
    });

    it.each([
      [CrawlErrorCodeEnum.ROBOTS_DISALLOWED, SourceStatusEnum.BLOCKED_BY_ROBOTS],
      [CrawlErrorCodeEnum.SOURCE_BLOCKED, SourceStatusEnum.BLOCKED]
    ])('stops the source on %s, tells the owner and yields nothing', async (code, status) => {
      crawler.fetchPage.mockRejectedValue(new CrawlError(code, 'careers.example.com'));

      await expect(subjectUnderTest.scan({ sourceId: 1 })).resolves.toMatchObject({ outcome: SourceScanOutcomeEnum.BLOCKED });
      expect(sources.markFailed).toHaveBeenCalledWith(1, `${code}: careers.example.com`, status);
      expect(events.sourceBlocked).toHaveBeenCalledWith(1);
      expect(listing.extract).not.toHaveBeenCalled();
    });

    it.each([CrawlErrorCodeEnum.FETCH_FAILED, CrawlErrorCodeEnum.PRIVATE_ADDRESS])(
      'records a %s failure and passes it on, the source keeping its status',
      async code => {
        const failure = new CrawlError(code, 'careers.example.com');

        crawler.fetchPage.mockRejectedValue(failure);

        await expect(subjectUnderTest.scan({ sourceId: 1 })).rejects.toBe(failure);
        expect(sources.markFailed).toHaveBeenCalledWith(1, failure.message, undefined);
        expect(events.sourceBlocked).not.toHaveBeenCalled();
      }
    );

    it('passes an error that is not a crawl failure on without recording it', async () => {
      crawler.fetchPage.mockRejectedValue(new TypeError('bug'));

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
      listing.extract.mockResolvedValue({ links: 40, positions: [] });
      vacancies.findOpenBySource.mockResolvedValue([{ vacancy_id: 5 } as VacancyRowType]);
      vacancies.applyScan.mockResolvedValue({ created: [], updated: [], closedIds: [] });

      await subjectUnderTest.scan({ sourceId: 1 });

      expect(vacancies.applyScan.mock.calls[0]?.[0].closeIds).toEqual([]);
    });
  });
});
