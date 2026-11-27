import { type DeepMocked, createMock } from '@golevelup/ts-vitest';
import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  HebrewRequirementEnum,
  SortOrderEnum,
  VacancyActionKindEnum,
  VacancyMatchVerdictEnum,
  VacancySortEnum,
  VacancyStageEnum,
  WorkModeEnum
} from '@job-agent/shared';

import type { IJobsDBVacancy } from '../../jobs-db/interfaces/jobs-db-vacancy.interface.js';
import { JobsDBRepository } from '../../jobs-db/repositories/jobs-db.repository.js';
import { MatchRuleEnum } from '../../matching/enums/match-rule.enum.js';
import { VacancyActionService } from '../../notify/services/vacancy-action.service.js';
import { VacancyReportRepository } from '../../report/repositories/vacancy-report.repository.js';
import { PipelineEventsService } from '../../vacancies/services/pipeline-events.service.js';
import { VacancyFilterOptionsRepository } from '../repositories/vacancy-filter-options.repository.js';
import { VacanciesAPIService } from './vacancies-a-p-i.service.js';

const FIRST_SEEN = new Date('2026-11-20T10:00:00Z');

const VACANCY: IJobsDBVacancy = {
  vacancyId: 7,
  sourceName: 'Northwind',
  title: 'Backend Developer',
  company: 'Northwind',
  city: 'Haifa',
  country: 'IL',
  workMode: WorkModeEnum.HYBRID,
  roleFamily: null,
  level: null,
  stage: VacancyStageEnum.EXTRACTED,
  skipReason: null,
  url: 'https://careers.example.com/jobs/7',
  textURL: null,
  data: {
    title: 'Backend Developer',
    requiredLanguages: [{ key: 'typescript', name: 'TypeScript', isUnknown: false }],
    preferredLanguages: [{ key: 'go', name: 'Go', isUnknown: false }],
    frameworks: [{ key: 'nestjs', name: 'NestJS', isUnknown: false }],
    yearsRequired: 5,
    hebrew: HebrewRequirementEnum.NONE,
    summary: 'Builds the services of a fictional shop.'
  },
  firstSeenAt: FIRST_SEEN,
  lastSeenAt: FIRST_SEEN,
  closedAt: null
};

describe('VacanciesAPIService (unit)', () => {
  let moduleFixture: TestingModule;
  let subjectUnderTest: VacanciesAPIService;
  let actions: DeepMocked<VacancyActionService>;
  let events: DeepMocked<PipelineEventsService>;
  let report: DeepMocked<VacancyReportRepository>;
  let jobsDB: DeepMocked<JobsDBRepository>;
  let options: DeepMocked<VacancyFilterOptionsRepository>;

  beforeEach(async () => {
    actions = createMock<VacancyActionService>();
    events = createMock<PipelineEventsService>();
    report = createMock<VacancyReportRepository>();
    jobsDB = createMock<JobsDBRepository>();
    options = createMock<VacancyFilterOptionsRepository>();
    moduleFixture = await Test.createTestingModule({
      providers: [
        VacanciesAPIService,
        { provide: VacancyActionService, useValue: actions },
        { provide: PipelineEventsService, useValue: events },
        { provide: VacancyReportRepository, useValue: report },
        { provide: JobsDBRepository, useValue: jobsDB },
        { provide: VacancyFilterOptionsRepository, useValue: options }
      ]
    }).compile();

    subjectUnderTest = moduleFixture.get(VacanciesAPIService);
  });

  afterEach(async () => {
    await moduleFixture.close();
  });

  it('should be defined', () => {
    expect(subjectUnderTest).toBeDefined();
  });

  describe('findAll', () => {
    it('maps the query onto the filter of the report and shapes the page with the findings of each verdict', async () => {
      report.findPage.mockResolvedValue({
        total: 41,
        vacancies: [
          {
            vacancyId: 7,
            title: 'Backend Developer',
            company: 'Northwind',
            city: 'Haifa',
            country: 'IL',
            workMode: WorkModeEnum.HYBRID,
            level: null,
            stage: VacancyStageEnum.EXTRACTED,
            sourceName: 'Northwind',
            firstSeenAt: FIRST_SEEN,
            lastAction: VacancyActionKindEnum.INTERESTED
          }
        ],
        matches: [
          {
            vacancyId: 7,
            profileName: 'developer',
            verdict: VacancyMatchVerdictEnum.ALMOST,
            reasons: [
              { rule: MatchRuleEnum.LANGUAGES, effect: VacancyMatchVerdictEnum.FIT, message: 'TypeScript matches' },
              { rule: MatchRuleEnum.EXPERIENCE, effect: VacancyMatchVerdictEnum.ALMOST, message: 'asks for 5 years' }
            ]
          }
        ]
      });

      const page = await subjectUnderTest.findAll({
        stage: [VacancyStageEnum.EXTRACTED],
        verdict: [VacancyMatchVerdictEnum.ALMOST],
        sourceId: [3],
        country: ['IL'],
        level: undefined,
        lastAction: undefined,
        q: 'backend',
        sort: VacancySortEnum.TITLE,
        order: SortOrderEnum.ASC,
        page: 2,
        pageSize: 25
      });

      expect(report.findPage).toHaveBeenCalledWith(
        {
          stages: [VacancyStageEnum.EXTRACTED],
          verdicts: [VacancyMatchVerdictEnum.ALMOST],
          sourceIds: [3],
          countries: ['IL'],
          levels: undefined,
          lastActions: undefined,
          query: 'backend'
        },
        { page: 2, pageSize: 25, sort: VacancySortEnum.TITLE, order: SortOrderEnum.ASC }
      );
      expect(page).toEqual({
        total: 41,
        page: 2,
        pageSize: 25,
        vacancies: [
          {
            vacancyId: 7,
            title: 'Backend Developer',
            company: 'Northwind',
            city: 'Haifa',
            country: 'IL',
            workMode: WorkModeEnum.HYBRID,
            level: null,
            stage: VacancyStageEnum.EXTRACTED,
            source: 'Northwind',
            firstSeenAt: '2026-11-20T10:00:00.000Z',
            lastAction: VacancyActionKindEnum.INTERESTED,
            verdicts: [{ profile: 'developer', verdict: VacancyMatchVerdictEnum.ALMOST, findings: ['asks for 5 years'] }]
          }
        ]
      });
    });

    it('gives a vacancy without verdicts an empty list', async () => {
      report.findPage.mockResolvedValue({
        total: 1,
        vacancies: [
          {
            vacancyId: 8,
            title: 'QA Engineer',
            company: 'Contoso',
            city: null,
            country: null,
            workMode: null,
            level: null,
            stage: VacancyStageEnum.LISTED,
            sourceName: 'Contoso',
            firstSeenAt: FIRST_SEEN,
            lastAction: null
          }
        ],
        matches: []
      });

      const page = await subjectUnderTest.findAll({
        sort: VacancySortEnum.FIRST_SEEN_AT,
        order: SortOrderEnum.DESC,
        page: 1,
        pageSize: 25
      });

      expect(page.vacancies[0]?.verdicts).toEqual([]);
    });
  });

  it('answers the values of the filters', async () => {
    options.findAll.mockResolvedValue({ sources: [{ sourceId: 3, name: 'Northwind' }], countries: ['IL'], cities: [] });

    await expect(subjectUnderTest.findFilterOptions()).resolves.toEqual({
      sources: [{ sourceId: 3, name: 'Northwind' }],
      countries: ['IL'],
      cities: []
    });
  });

  describe('findOne', () => {
    it('shapes the card with the extraction, the verdicts and the choices', async () => {
      jobsDB.findVacancy.mockResolvedValue(VACANCY);
      jobsDB.findVacancyMatches.mockResolvedValue([
        {
          profileName: 'developer',
          verdict: VacancyMatchVerdictEnum.FIT,
          reasons: [{ rule: MatchRuleEnum.LANGUAGES, effect: VacancyMatchVerdictEnum.FIT, message: 'TypeScript matches' }],
          notifiedAt: FIRST_SEEN
        }
      ]);
      jobsDB.findVacancyActions.mockResolvedValue([{ kind: VacancyActionKindEnum.APPLIED, at: FIRST_SEEN }]);

      const card = await subjectUnderTest.findOne(7);

      expect(card.extraction).toEqual({
        summary: 'Builds the services of a fictional shop.',
        programmingLanguages: [
          { name: 'TypeScript', required: true },
          { name: 'Go', required: false }
        ],
        frameworks: ['NestJS'],
        yearsRequired: 5,
        hebrew: HebrewRequirementEnum.NONE
      });
      expect(card.matches).toEqual([
        {
          profile: 'developer',
          verdict: VacancyMatchVerdictEnum.FIT,
          findings: [{ rule: MatchRuleEnum.LANGUAGES, effect: VacancyMatchVerdictEnum.FIT, message: 'TypeScript matches' }],
          notifiedAt: '2026-11-20T10:00:00.000Z'
        }
      ]);
      expect(card.actions).toEqual([{ kind: VacancyActionKindEnum.APPLIED, at: '2026-11-20T10:00:00.000Z' }]);
      expect(card).toMatchObject({ source: 'Northwind', closedAt: null, firstSeenAt: '2026-11-20T10:00:00.000Z' });
    });

    it('gives a vacancy that was never extracted no extraction', async () => {
      jobsDB.findVacancy.mockResolvedValue({ ...VACANCY, data: null, stage: VacancyStageEnum.LISTED });
      jobsDB.findVacancyMatches.mockResolvedValue([]);
      jobsDB.findVacancyActions.mockResolvedValue([]);

      await expect(subjectUnderTest.findOne(7)).resolves.toMatchObject({ extraction: null, matches: [], actions: [] });
    });

    it('answers VACANCY_NOT_FOUND for a vacancy that does not exist', async () => {
      jobsDB.findVacancy.mockResolvedValue(undefined);
      jobsDB.findVacancyMatches.mockResolvedValue([]);
      jobsDB.findVacancyActions.mockResolvedValue([]);

      await expect(subjectUnderTest.findOne(7)).rejects.toThrow(NotFoundException);
    });
  });

  describe('recordAction', () => {
    it('stores a new choice and queues the tick under its Telegram messages', async () => {
      jobsDB.findVacancy.mockResolvedValue(VACANCY);
      actions.record.mockResolvedValue(true);

      await expect(subjectUnderTest.recordAction(7, VacancyActionKindEnum.APPLIED)).resolves.toEqual({
        kind: VacancyActionKindEnum.APPLIED,
        recorded: true
      });
      expect(actions.record).toHaveBeenCalledWith(7, VacancyActionKindEnum.APPLIED);
      expect(events.vacancyActionRecorded).toHaveBeenCalledWith(7);
    });

    it('queues nothing for a repeat of the latest choice', async () => {
      jobsDB.findVacancy.mockResolvedValue(VACANCY);
      actions.record.mockResolvedValue(false);

      await expect(subjectUnderTest.recordAction(7, VacancyActionKindEnum.APPLIED)).resolves.toEqual({
        kind: VacancyActionKindEnum.APPLIED,
        recorded: false
      });
      expect(events.vacancyActionRecorded).not.toHaveBeenCalled();
    });

    it('stores nothing for a vacancy that does not exist', async () => {
      jobsDB.findVacancy.mockResolvedValue(undefined);

      await expect(subjectUnderTest.recordAction(7, VacancyActionKindEnum.APPLIED)).rejects.toThrow(NotFoundException);
      expect(actions.record).not.toHaveBeenCalled();
    });
  });
});
