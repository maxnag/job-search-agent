import { type DeepMocked, createMock } from '@golevelup/ts-vitest';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { HebrewRequirementEnum, SourceFetchModeEnum, SourceStatusEnum, VacancyStageEnum, WorkModeEnum } from '@job-agent/shared';

import { createConfigMock } from '../../../../test/config-service.mock.js';
import { ATSClientRegistry } from '../../ats/services/a-t-s-client.registry.js';
import { CrawlErrorCodeEnum } from '../../crawler/enums/crawl-error-code.enum.js';
import { CrawlError } from '../../crawler/errors/crawl.error.js';
import { CrawlerService } from '../../crawler/services/crawler.service.js';
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

  beforeEach(async () => {
    crawler = createMock<CrawlerService>();
    extraction = createMock<VacancyExtractionService>();
    matching = createMock<VacancyMatchingService>();
    events = createMock<PipelineEventsService>();
    vacancies = createMock<VacancyRepository>();
    sources = createMock<SourceRepository>();
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
        { provide: ATSClientRegistry, useValue: {} },
        { provide: VacancyExtractionService, useValue: extraction },
        { provide: VacancyMatchingService, useValue: matching },
        { provide: PipelineEventsService, useValue: events },
        { provide: VacancyRepository, useValue: vacancies },
        { provide: SourceRepository, useValue: sources },
        { provide: ConfigService, useValue: createConfigMock({ VACANCY_TEXT_MAX_CHARS: 12_000 }) }
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
});
