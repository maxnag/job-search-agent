import { type DeepMocked, createMock } from '@golevelup/ts-vitest';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  ATSKindEnum,
  HebrewRequirementEnum,
  SourceFetchModeEnum,
  SourceStatusEnum,
  VacancyStageEnum,
  WorkModeEnum
} from '@job-agent/shared';

import { createConfigMock } from '../../../../test/config-service.mock.js';
import type { IATSClient } from '../../ats/interfaces/a-t-s-client.interface.js';
import { ATSClientRegistry } from '../../ats/services/a-t-s-client.registry.js';
import { CrawlErrorCodeEnum } from '../../crawler/enums/crawl-error-code.enum.js';
import { CrawlError } from '../../crawler/errors/crawl.error.js';
import { CrawlerService } from '../../crawler/services/crawler.service.js';
import { CompanyPostingService } from '../../discovery/services/company-posting.service.js';
import { VacancyMatchingService } from '../../matching/services/vacancy-matching.service.js';
import type { SourceRowType } from '../../search/interfaces/source-row.interface.js';
import { SourceRepository } from '../../search/repositories/source.repository.js';
import type { VacancyRowType } from '../../vacancies/interfaces/vacancy-row.interface.js';
import { VacancyRepository } from '../../vacancies/repositories/vacancy.repository.js';
import { PipelineEventsService } from '../../vacancies/services/pipeline-events.service.js';
import { VacancyExtractionOutcomeEnum } from '../enums/vacancy-extraction-outcome.enum.js';
import { textHash } from '../helpers/vacancy-text.helper.js';
import type { VacancyExtractionType } from '../schemas/vacancy-extraction.schema.js';
import { VacancyExtractionOrchestrator } from './vacancy-extraction.orchestrator.js';
import { VacancyExtractionService } from './vacancy-extraction.service.js';

const PAGE_TEXT = 'Backend Developer\nTypeScript required';

const VACANCY = {
  vacancy_id: 7,
  source_id: 1,
  vacancy_url: 'https://careers.example.com/jobs/7',
  vacancy_stage: VacancyStageEnum.LISTED,
  vacancy_data: null,
  vacancy_text_hash: null
} as VacancyRowType;

const EXTRACTION: VacancyExtractionType = {
  is_open: true,
  title: 'Backend Developer',
  company: 'Northwind',
  level: null,
  country: 'IL',
  city: 'Haifa',
  work_mode: WorkModeEnum.HYBRID,
  programming_languages: [{ name: 'TypeScript', required: true }],
  frameworks: [],
  years_required: null,
  hebrew: HebrewRequirementEnum.NONE,
  summary: 'Builds the API.'
};

describe('VacancyExtractionOrchestrator (unit)', () => {
  let moduleFixture: TestingModule;
  let subjectUnderTest: VacancyExtractionOrchestrator;
  let crawler: DeepMocked<CrawlerService>;
  let extraction: DeepMocked<VacancyExtractionService>;
  let matching: DeepMocked<VacancyMatchingService>;
  let events: DeepMocked<PipelineEventsService>;
  let vacancies: DeepMocked<VacancyRepository>;
  let sources: DeepMocked<SourceRepository>;
  let registry: DeepMocked<ATSClientRegistry>;
  let atsClient: DeepMocked<IATSClient>;
  let postings: DeepMocked<CompanyPostingService>;

  beforeEach(async () => {
    crawler = createMock<CrawlerService>();
    extraction = createMock<VacancyExtractionService>();
    matching = createMock<VacancyMatchingService>();
    events = createMock<PipelineEventsService>();
    vacancies = createMock<VacancyRepository>();
    sources = createMock<SourceRepository>();
    registry = createMock<ATSClientRegistry>();
    atsClient = createMock<IATSClient>();
    postings = createMock<CompanyPostingService>();
    postings.isEnabled.mockReturnValue(true);
    registry.findOne.mockReturnValue(atsClient);
    vacancies.findOne.mockResolvedValue(VACANCY);
    sources.findOne.mockResolvedValue({ source_fetch_mode: SourceFetchModeEnum.RENDERED } as SourceRowType);
    crawler.fetchPage.mockResolvedValue({
      url: VACANCY.vacancy_url,
      status: 200,
      headers: {},
      html: '<main><p>Backend Developer</p><p>TypeScript required</p></main>'
    });
    extraction.extract.mockResolvedValue({ data: EXTRACTION, model: 'claude-haiku-5-5' });
    matching.matchVacancy.mockResolvedValue({ verdicts: { fit: 1, almost: 0, no_fit: 0 }, notifiableMatchIds: [31], unreadable: 0 });
    moduleFixture = await Test.createTestingModule({
      providers: [
        VacancyExtractionOrchestrator,
        { provide: CrawlerService, useValue: crawler },
        { provide: ATSClientRegistry, useValue: registry },
        { provide: CompanyPostingService, useValue: postings },
        { provide: VacancyExtractionService, useValue: extraction },
        { provide: VacancyMatchingService, useValue: matching },
        { provide: PipelineEventsService, useValue: events },
        { provide: VacancyRepository, useValue: vacancies },
        { provide: SourceRepository, useValue: sources },
        {
          provide: ConfigService,
          useValue: createConfigMock({ VACANCY_TEXT_MAX_CHARS: 12_000, JOB_MAIL_TEXT_RECHECK_DAYS: 7, JOB_MAIL_TEXT_MAX_SEARCHES: 3 })
        }
      ]
    }).compile();

    subjectUnderTest = moduleFixture.get(VacancyExtractionOrchestrator);
  });

  afterEach(async () => {
    await moduleFixture.close();
  });

  it('should be defined', () => {
    expect(subjectUnderTest).toBeDefined();
  });

  it('fetches the page in the mode of its source, extracts, stores, matches and announces the matches', async () => {
    await expect(subjectUnderTest.extract(7)).resolves.toEqual({ vacancyId: 7, outcome: VacancyExtractionOutcomeEnum.EXTRACTED });

    expect(crawler.fetchPage).toHaveBeenCalledWith(VACANCY.vacancy_url, SourceFetchModeEnum.RENDERED);
    expect(extraction.extract).toHaveBeenCalledWith(PAGE_TEXT);

    const [vacancyId, values] = vacancies.update.mock.calls[0] ?? [];

    expect(vacancyId).toBe(7);
    expect(values).toMatchObject({
      vacancy_stage: VacancyStageEnum.EXTRACTED,
      vacancy_skip_reason: null,
      vacancy_text_hash: textHash(PAGE_TEXT),
      vacancy_country: 'IL',
      vacancy_city: 'Haifa',
      vacancy_work_mode: WorkModeEnum.HYBRID,
      vacancy_checked_at: expect.any(Date) as Date
    });
    expect(values?.vacancy_data).toMatchObject({ title: 'Backend Developer', model: 'claude-haiku-5-5' });
    expect(matching.matchVacancy).toHaveBeenCalledWith(
      expect.objectContaining({ vacancy_id: 7, vacancy_stage: VacancyStageEnum.EXTRACTED })
    );
    expect(events.vacanciesMatched).toHaveBeenCalledWith([31]);
    expect(events.vacancyChanged).not.toHaveBeenCalled();
  });

  it('fetches in the html mode when the source is gone', async () => {
    sources.findOne.mockResolvedValue(undefined);

    await subjectUnderTest.extract(7);

    expect(crawler.fetchPage).toHaveBeenCalledWith(VACANCY.vacancy_url, SourceFetchModeEnum.HTML);
  });

  it('refuses an unknown vacancy', async () => {
    vacancies.findOne.mockResolvedValue(undefined);

    await expect(subjectUnderTest.extract(9)).rejects.toThrow('VACANCY_NOT_FOUND: 9');
  });

  it.each([VacancyStageEnum.SKIPPED, VacancyStageEnum.CLOSED])('does not extract a %s vacancy', async stage => {
    vacancies.findOne.mockResolvedValue({ ...VACANCY, vacancy_stage: stage });

    await expect(subjectUnderTest.extract(7)).resolves.toEqual({ vacancyId: 7, outcome: VacancyExtractionOutcomeEnum.SKIPPED });
    expect(crawler.fetchPage).not.toHaveBeenCalled();
  });

  it('only marks a known page as checked when its text did not change — no LLM call', async () => {
    vacancies.findOne.mockResolvedValue({
      ...VACANCY,
      vacancy_stage: VacancyStageEnum.EXTRACTED,
      vacancy_data: { title: 'x' },
      vacancy_text_hash: textHash(PAGE_TEXT)
    });

    await expect(subjectUnderTest.extract(7)).resolves.toMatchObject({ outcome: VacancyExtractionOutcomeEnum.UNCHANGED });
    expect(vacancies.update).toHaveBeenCalledWith(7, { vacancy_checked_at: expect.any(Date) as Date });
    expect(extraction.extract).not.toHaveBeenCalled();
  });

  it('extracts a known page again when its text changed and tells the owner', async () => {
    vacancies.findOne.mockResolvedValue({
      ...VACANCY,
      vacancy_stage: VacancyStageEnum.EXTRACTED,
      vacancy_data: { title: 'x' },
      vacancy_text_hash: 'old'
    });

    await expect(subjectUnderTest.extract(7)).resolves.toMatchObject({ outcome: VacancyExtractionOutcomeEnum.CHANGED });
    expect(events.vacancyChanged).toHaveBeenCalledWith(7);
  });

  it('closes a vacancy the page says is closed', async () => {
    extraction.extract.mockResolvedValue({ data: { ...EXTRACTION, is_open: false }, model: 'm' });

    await expect(subjectUnderTest.extract(7)).resolves.toMatchObject({ outcome: VacancyExtractionOutcomeEnum.CLOSED });
    expect(vacancies.close).toHaveBeenCalledWith(7);
    expect(events.vacanciesClosed).toHaveBeenCalledWith([7]);
    expect(matching.matchVacancy).not.toHaveBeenCalled();
  });

  it('closes a vacancy whose page is gone', async () => {
    crawler.fetchPage.mockRejectedValue(new CrawlError(CrawlErrorCodeEnum.FETCH_HTTP_ERROR, 'careers.example.com/jobs/7: HTTP 404'));

    await expect(subjectUnderTest.extract(7)).resolves.toMatchObject({ outcome: VacancyExtractionOutcomeEnum.CLOSED });
    expect(vacancies.close).toHaveBeenCalledWith(7);
  });

  it.each([
    [CrawlErrorCodeEnum.ROBOTS_DISALLOWED, 'robots.txt disallows the vacancy page'],
    [CrawlErrorCodeEnum.PRIVATE_ADDRESS, 'the vacancy link leads to a private network address']
  ])('skips a vacancy on %s, with the reason', async (code, reason) => {
    crawler.fetchPage.mockRejectedValue(new CrawlError(code, 'careers.example.com'));

    await expect(subjectUnderTest.extract(7)).resolves.toMatchObject({ outcome: VacancyExtractionOutcomeEnum.SKIPPED });
    expect(vacancies.update).toHaveBeenCalledWith(7, { vacancy_stage: VacancyStageEnum.SKIPPED, vacancy_skip_reason: reason });
  });

  it('stops the source of a blocked vacancy page, tells the owner and passes the failure on', async () => {
    const failure = new CrawlError(CrawlErrorCodeEnum.SOURCE_BLOCKED, 'careers.example.com: HTTP 403');

    crawler.fetchPage.mockRejectedValue(failure);

    await expect(subjectUnderTest.extract(7)).rejects.toBe(failure);
    expect(sources.markFailed).toHaveBeenCalledWith(1, failure.message, SourceStatusEnum.BLOCKED);
    expect(events.sourceBlocked).toHaveBeenCalledWith(1);
  });

  it('passes a transient failure and a foreign error on untouched', async () => {
    crawler.fetchPage.mockRejectedValueOnce(new CrawlError(CrawlErrorCodeEnum.FETCH_FAILED, 'timeout'));
    await expect(subjectUnderTest.extract(7)).rejects.toMatchObject({ code: CrawlErrorCodeEnum.FETCH_FAILED });

    crawler.fetchPage.mockRejectedValueOnce(new TypeError('bug'));
    await expect(subjectUnderTest.extract(7)).rejects.toThrow('bug');

    expect(vacancies.update).not.toHaveBeenCalled();
    expect(sources.markFailed).not.toHaveBeenCalled();
  });

  it('passes an LLM failure on without storing anything', async () => {
    extraction.extract.mockRejectedValue(new Error('LLM_OUTPUT_SCHEMA_INVALID: title'));

    await expect(subjectUnderTest.extract(7)).rejects.toThrow('LLM_OUTPUT_SCHEMA_INVALID');
    expect(vacancies.update).not.toHaveBeenCalled();
  });

  describe('a vacancy of an applicant tracking system board', () => {
    const ATS_SOURCE = {
      source_id: 1,
      source_url: 'https://jobs.lever.co/Contoso',
      source_fetch_mode: SourceFetchModeEnum.ATS
    } as SourceRowType;

    beforeEach(() => {
      sources.findOne.mockResolvedValue(ATS_SOURCE);
      vacancies.findOne.mockResolvedValue({ ...VACANCY, vacancy_url: 'https://jobs.lever.co/Contoso/a1', vacancy_external_id: 'a1' });
      atsClient.fetchPosting.mockResolvedValue('<main><p>Backend Developer</p><p>TypeScript required</p></main>');
    });

    it('reads the posting from the board API instead of the page', async () => {
      await expect(subjectUnderTest.extract(7)).resolves.toEqual({ vacancyId: 7, outcome: VacancyExtractionOutcomeEnum.EXTRACTED });

      expect(registry.findOne).toHaveBeenCalledWith(ATSKindEnum.LEVER);
      expect(atsClient.fetchPosting).toHaveBeenCalledWith({ board: 'Contoso', externalId: 'a1', url: 'https://jobs.lever.co/Contoso/a1' });
      expect(crawler.fetchPage).not.toHaveBeenCalled();
      expect(extraction.extract).toHaveBeenCalledWith(PAGE_TEXT);
    });

    it('closes a vacancy whose posting is gone from the board', async () => {
      atsClient.fetchPosting.mockRejectedValue(new CrawlError(CrawlErrorCodeEnum.FETCH_HTTP_ERROR, 'api.lever.co: HTTP 404'));

      await expect(subjectUnderTest.extract(7)).resolves.toMatchObject({ outcome: VacancyExtractionOutcomeEnum.CLOSED });
      expect(vacancies.close).toHaveBeenCalledWith(7);
    });

    it('throws ATS_POSTING_UNKNOWN for a vacancy without a position id', async () => {
      vacancies.findOne.mockResolvedValue({ ...VACANCY, vacancy_external_id: null });

      await expect(subjectUnderTest.extract(7)).rejects.toThrow('ATS_POSTING_UNKNOWN: vacancy 7 of source 1');
      expect(atsClient.fetchPosting).not.toHaveBeenCalled();
    });

    it('throws ATS_POSTING_UNKNOWN when the source link is not a board', async () => {
      sources.findOne.mockResolvedValue({ ...ATS_SOURCE, source_url: 'https://careers.example.com/jobs' });

      await expect(subjectUnderTest.extract(7)).rejects.toThrow('ATS_POSTING_UNKNOWN');
      expect(registry.findOne).not.toHaveBeenCalled();
    });
  });

  describe('a vacancy of a job alert', () => {
    const NO_TEXT_REASON = 'no description yet: the vacancy is not on a board of its company (Comeet, Greenhouse, Lever)';

    const JOB_MAIL_SOURCE = {
      source_id: 25,
      source_url: 'mailto:@jobs.example.com',
      source_fetch_mode: SourceFetchModeEnum.JOB_MAIL
    } as SourceRowType;

    const LINKEDIN_VACANCY = {
      ...VACANCY,
      source_id: 25,
      vacancy_url: 'https://www.linkedin.com/jobs/view/4100000001/',
      vacancy_company: 'Northwind',
      vacancy_text_url: null,
      vacancy_text_searched_at: null,
      vacancy_text_searches: 0
    } as VacancyRowType;

    beforeEach(() => {
      sources.findOne.mockResolvedValue(JOB_MAIL_SOURCE);
      vacancies.findOne.mockResolvedValue(LINKEDIN_VACANCY);
      atsClient.fetchPosting.mockResolvedValue('<main><p>Backend Developer</p><p>TypeScript required</p></main>');
    });

    it('fetches a career page link of an alert in the html mode', async () => {
      vacancies.findOne.mockResolvedValue({ ...LINKEDIN_VACANCY, vacancy_url: 'https://careers.example.com/jobs/7' });

      await expect(subjectUnderTest.extract(7)).resolves.toMatchObject({ outcome: VacancyExtractionOutcomeEnum.EXTRACTED });
      expect(crawler.fetchPage).toHaveBeenCalledWith('https://careers.example.com/jobs/7', SourceFetchModeEnum.HTML);
      expect(postings.find).not.toHaveBeenCalled();
    });

    it('never opens a LinkedIn link: reads the same position from the board of the company and remembers it', async () => {
      postings.find.mockResolvedValue({ url: 'https://job-boards.greenhouse.io/northwind/jobs/42', externalId: '42' });

      await expect(subjectUnderTest.extract(7)).resolves.toMatchObject({ outcome: VacancyExtractionOutcomeEnum.EXTRACTED });

      expect(crawler.fetchPage).not.toHaveBeenCalled();
      expect(vacancies.update).toHaveBeenCalledWith(7, {
        vacancy_text_searched_at: expect.any(Date) as Date,
        vacancy_text_searches: 1,
        vacancy_text_url: 'https://job-boards.greenhouse.io/northwind/jobs/42',
        vacancy_external_id: '42',
        vacancy_skip_reason: null
      });
      expect(registry.findOne).toHaveBeenCalledWith(ATSKindEnum.GREENHOUSE);
      expect(atsClient.fetchPosting).toHaveBeenCalledWith({
        board: 'northwind',
        externalId: '42',
        url: 'https://job-boards.greenhouse.io/northwind/jobs/42'
      });
      expect(extraction.extract).toHaveBeenCalledWith(PAGE_TEXT);
    });

    it('reads a found board posting again without a new search', async () => {
      vacancies.findOne.mockResolvedValue({
        ...LINKEDIN_VACANCY,
        vacancy_text_url: 'https://job-boards.greenhouse.io/northwind/jobs/42',
        vacancy_external_id: '42'
      });

      await expect(subjectUnderTest.extract(7)).resolves.toMatchObject({ outcome: VacancyExtractionOutcomeEnum.EXTRACTED });
      expect(postings.find).not.toHaveBeenCalled();
      expect(atsClient.fetchPosting).toHaveBeenCalledTimes(1);
    });

    it('leaves the vacancy listed with a reason and counts the search when the board has no such position', async () => {
      postings.find.mockResolvedValue(undefined);

      await expect(subjectUnderTest.extract(7)).resolves.toEqual({ vacancyId: 7, outcome: VacancyExtractionOutcomeEnum.NO_TEXT });
      expect(vacancies.update).toHaveBeenCalledWith(7, {
        vacancy_text_searched_at: expect.any(Date) as Date,
        vacancy_text_searches: 1,
        vacancy_skip_reason: NO_TEXT_REASON
      });
      expect(crawler.fetchPage).not.toHaveBeenCalled();
      expect(extraction.extract).not.toHaveBeenCalled();
      expect(matching.matchVacancy).not.toHaveBeenCalled();
    });

    it('searches again only after JOB_MAIL_TEXT_RECHECK_DAYS', async () => {
      const day = 24 * 60 * 60 * 1000;

      postings.find.mockResolvedValue(undefined);

      vacancies.findOne.mockResolvedValue({
        ...LINKEDIN_VACANCY,
        vacancy_text_searched_at: new Date(Date.now() - 6 * day),
        vacancy_text_searches: 1
      });

      await expect(subjectUnderTest.extract(7)).resolves.toMatchObject({ outcome: VacancyExtractionOutcomeEnum.NO_TEXT });
      expect(postings.find).not.toHaveBeenCalled();
      expect(vacancies.update).toHaveBeenCalledWith(7, { vacancy_skip_reason: NO_TEXT_REASON });

      vacancies.findOne.mockResolvedValue({
        ...LINKEDIN_VACANCY,
        vacancy_text_searched_at: new Date(Date.now() - 8 * day),
        vacancy_text_searches: 1
      });

      await subjectUnderTest.extract(7);

      expect(postings.find).toHaveBeenCalledTimes(1);
      expect(vacancies.update).toHaveBeenLastCalledWith(7, expect.objectContaining({ vacancy_text_searches: 2 }));
    });

    it('stops searching after JOB_MAIL_TEXT_MAX_SEARCHES', async () => {
      vacancies.findOne.mockResolvedValue({ ...LINKEDIN_VACANCY, vacancy_text_searched_at: new Date(0), vacancy_text_searches: 3 });

      await expect(subjectUnderTest.extract(7)).resolves.toMatchObject({ outcome: VacancyExtractionOutcomeEnum.NO_TEXT });
      expect(postings.find).not.toHaveBeenCalled();
    });

    it('does not search without the key of the web search', async () => {
      postings.isEnabled.mockReturnValue(false);

      await expect(subjectUnderTest.extract(7)).resolves.toMatchObject({ outcome: VacancyExtractionOutcomeEnum.NO_TEXT });
      expect(postings.find).not.toHaveBeenCalled();
      expect(vacancies.update).toHaveBeenCalledWith(7, { vacancy_skip_reason: NO_TEXT_REASON });
    });

    it('skips a vacancy whose site refuses the crawler, leaving the mailing source alone', async () => {
      vacancies.findOne.mockResolvedValue({ ...LINKEDIN_VACANCY, vacancy_url: 'https://careers.example.com/jobs/7' });
      crawler.fetchPage.mockRejectedValue(new CrawlError(CrawlErrorCodeEnum.SOURCE_BLOCKED, 'careers.example.com: HTTP 403'));

      await expect(subjectUnderTest.extract(7)).resolves.toMatchObject({ outcome: VacancyExtractionOutcomeEnum.SKIPPED });
      expect(vacancies.update).toHaveBeenCalledWith(7, {
        vacancy_stage: VacancyStageEnum.SKIPPED,
        vacancy_skip_reason: 'the site of the vacancy refused the crawler (403, 429 or a challenge)'
      });
      expect(sources.markFailed).not.toHaveBeenCalled();
      expect(events.sourceBlocked).not.toHaveBeenCalled();
    });
  });
});
