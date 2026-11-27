import { Test, type TestingModule } from '@nestjs/testing';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { truncateTables, vacancies } from '@job-agent/db';
import {
  SeniorityLevelEnum,
  SortOrderEnum,
  SourceFetchModeEnum,
  SourceStatusEnum,
  VacancyActionKindEnum,
  VacancyLastActionEnum,
  VacancyMatchVerdictEnum,
  VacancySortEnum,
  VacancyStageEnum,
  WorkModeEnum
} from '@job-agent/shared';

import { testDatabaseProvider } from '../../../../test/test-database.provider.js';
import {
  PIPELINE_TABLES,
  insertAction,
  insertMatch,
  insertProfileWithResume,
  insertResume,
  insertSource,
  insertVacancy
} from '../../../../test/vacancy-fixtures.js';
import { DatabaseService } from '../../database/services/database.service.js';
import { MatchRuleEnum } from '../../matching/enums/match-rule.enum.js';
import type { IVacancyReportFilter } from '../interfaces/vacancy-report-filter.interface.js';
import type { IVacancyReportPageRequest } from '../interfaces/vacancy-report-page.interface.js';
import { VacancyReportRepository } from './vacancy-report.repository.js';

describe('VacancyReportRepository (e2e)', () => {
  let moduleFixture: TestingModule;
  let repository: VacancyReportRepository;
  let database: DatabaseService;

  /**
   * Ids of the vacancies the filter selects
   *
   * @param {IVacancyReportFilter} filter
   *
   * @returns {Promise<number[]>}
   */
  async function selected(filter: IVacancyReportFilter): Promise<number[]> {
    return (await repository.findAll(filter)).vacancies.map(vacancy => vacancy.vacancyId);
  }

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({ providers: [VacancyReportRepository, testDatabaseProvider()] }).compile();
    repository = moduleFixture.get(VacancyReportRepository);
    database = moduleFixture.get(DatabaseService);
  });

  beforeEach(async () => {
    await truncateTables(database.db, PIPELINE_TABLES);
  });

  afterAll(async () => {
    await moduleFixture.close();
  });

  it('gives nothing without sources', async () => {
    await expect(repository.findAll()).resolves.toEqual({ sources: [], vacancies: [], matches: [] });
  });

  it('reads every source, its vacancies and the verdicts of the current resumes', async () => {
    const source = await insertSource(database, {
      source_name: 'Northwind',
      source_status: SourceStatusEnum.BLOCKED,
      source_last_error: 'HTTP 403'
    });
    const { profileId, resumeId: older } = await insertProfileWithResume(database, 'developer', { isCurrent: false });
    const current = await insertResume(database, profileId);
    const skipped = await insertVacancy(database, source.source_id, {
      vacancy_stage: VacancyStageEnum.SKIPPED,
      vacancy_skip_reason: 'role qa is not searched'
    });
    const extracted = await insertVacancy(database, source.source_id, { vacancy_stage: VacancyStageEnum.EXTRACTED });
    const reasons = [{ rule: MatchRuleEnum.LANGUAGES, effect: VacancyMatchVerdictEnum.FIT, message: 'matches TypeScript' }];

    await insertMatch(database, extracted.vacancy_id, current, { vacancy_match_reasons: reasons });
    await insertMatch(database, extracted.vacancy_id, older, { vacancy_match_verdict: VacancyMatchVerdictEnum.NO_FIT });

    const data = await repository.findAll();

    expect(data.sources).toEqual([
      {
        sourceId: source.source_id,
        name: 'Northwind',
        url: source.source_url,
        fetchMode: SourceFetchModeEnum.HTML,
        isActive: true,
        status: SourceStatusEnum.BLOCKED,
        lastScanAt: null,
        lastError: 'HTTP 403'
      }
    ]);
    expect(data.vacancies.map(vacancy => [vacancy.vacancyId, vacancy.stage, vacancy.skipReason])).toEqual([
      [skipped.vacancy_id, VacancyStageEnum.SKIPPED, 'role qa is not searched'],
      [extracted.vacancy_id, VacancyStageEnum.EXTRACTED, null]
    ]);
    expect(data.matches).toEqual([
      { vacancyId: extracted.vacancy_id, profileName: 'developer', verdict: VacancyMatchVerdictEnum.FIT, reasons }
    ]);
  });

  it('reads one source and its vacancies when asked', async () => {
    const wanted = await insertSource(database);
    const other = await insertSource(database);
    const vacancy = await insertVacancy(database, wanted.source_id);

    await insertVacancy(database, other.source_id);

    const data = await repository.findAll({ sourceIds: [wanted.source_id] });

    expect(data.sources.map(source => source.sourceId)).toEqual([wanted.source_id]);
    expect(data.vacancies.map(row => row.vacancyId)).toEqual([vacancy.vacancy_id]);
  });
  it('hides closed positions unless the flag or the stage asks for them', async () => {
    const source = await insertSource(database);
    const open = await insertVacancy(database, source.source_id);
    const closed = await insertVacancy(database, source.source_id, { vacancy_stage: VacancyStageEnum.CLOSED });

    await expect(selected({})).resolves.toEqual([open.vacancy_id]);
    await expect(selected({ closed: true })).resolves.toEqual([open.vacancy_id, closed.vacancy_id]);
    await expect(selected({ stages: [VacancyStageEnum.CLOSED] })).resolves.toEqual([closed.vacancy_id]);
  });

  it('selects by source and by stage, the values of one condition as alternatives', async () => {
    const first = await insertSource(database);
    const second = await insertSource(database);
    const third = await insertSource(database);
    const listed = await insertVacancy(database, first.source_id);
    const skipped = await insertVacancy(database, second.source_id, { vacancy_stage: VacancyStageEnum.SKIPPED });
    const extracted = await insertVacancy(database, first.source_id, { vacancy_stage: VacancyStageEnum.EXTRACTED });

    await insertVacancy(database, third.source_id);

    const data = await repository.findAll({ sourceIds: [first.source_id, second.source_id] });

    expect(data.sources.map(source => source.sourceId)).toEqual([first.source_id, second.source_id]);
    expect(data.vacancies.map(vacancy => vacancy.vacancyId)).toEqual([listed.vacancy_id, skipped.vacancy_id, extracted.vacancy_id]);
    await expect(selected({ stages: [VacancyStageEnum.SKIPPED, VacancyStageEnum.EXTRACTED] })).resolves.toEqual([
      skipped.vacancy_id,
      extracted.vacancy_id
    ]);
  });

  it('selects by a verdict against the current resume of any profile and reads the verdicts of those only', async () => {
    const source = await insertSource(database);
    const { resumeId: developer } = await insertProfileWithResume(database, 'developer');
    const { profileId, resumeId: older } = await insertProfileWithResume(database, 'lead', { isCurrent: false });
    const lead = await insertResume(database, profileId);
    const fits = await insertVacancy(database, source.source_id, { vacancy_stage: VacancyStageEnum.EXTRACTED });
    const fitsOlder = await insertVacancy(database, source.source_id, { vacancy_stage: VacancyStageEnum.EXTRACTED });
    const almost = await insertVacancy(database, source.source_id, { vacancy_stage: VacancyStageEnum.EXTRACTED });

    await insertMatch(database, fits.vacancy_id, developer, { vacancy_match_verdict: VacancyMatchVerdictEnum.NO_FIT });
    await insertMatch(database, fits.vacancy_id, lead);
    await insertMatch(database, fitsOlder.vacancy_id, older);
    await insertMatch(database, fitsOlder.vacancy_id, lead, { vacancy_match_verdict: VacancyMatchVerdictEnum.NO_FIT });
    await insertMatch(database, almost.vacancy_id, developer, { vacancy_match_verdict: VacancyMatchVerdictEnum.ALMOST });

    const data = await repository.findAll({ verdicts: [VacancyMatchVerdictEnum.FIT] });

    expect(data.vacancies.map(vacancy => vacancy.vacancyId)).toEqual([fits.vacancy_id]);
    expect(data.matches.map(match => [match.vacancyId, match.profileName, match.verdict])).toEqual([
      [fits.vacancy_id, 'developer', VacancyMatchVerdictEnum.NO_FIT],
      [fits.vacancy_id, 'lead', VacancyMatchVerdictEnum.FIT]
    ]);
    await expect(selected({ verdicts: [VacancyMatchVerdictEnum.FIT, VacancyMatchVerdictEnum.ALMOST] })).resolves.toEqual([
      fits.vacancy_id,
      almost.vacancy_id
    ]);
  });

  it('selects by a reason in the skip reason or a finding of a current verdict, case aside, wildcards taken literally', async () => {
    const source = await insertSource(database);
    const { resumeId } = await insertProfileWithResume(database, 'developer');
    const skipped = await insertVacancy(database, source.source_id, {
      vacancy_stage: VacancyStageEnum.SKIPPED,
      vacancy_skip_reason: 'Hebrew is required'
    });
    const found = await insertVacancy(database, source.source_id, { vacancy_stage: VacancyStageEnum.EXTRACTED });
    const reasons = [{ rule: MatchRuleEnum.LANGUAGES, effect: VacancyMatchVerdictEnum.NO_FIT, message: 'needs HEBREW, 100% on site' }];

    await insertMatch(database, found.vacancy_id, resumeId, { vacancy_match_reasons: reasons });
    await insertVacancy(database, source.source_id, { vacancy_stage: VacancyStageEnum.SKIPPED, vacancy_skip_reason: 'role qa' });

    await expect(selected({ reason: 'hebrew' })).resolves.toEqual([skipped.vacancy_id, found.vacancy_id]);
    await expect(selected({ reason: '100%' })).resolves.toEqual([found.vacancy_id]);
    await expect(selected({ reason: '1_0' })).resolves.toEqual([]);
  });

  it('selects by country, work mode, title and the days since first seen', async () => {
    const source = await insertSource(database);
    const haifa = await insertVacancy(database, source.source_id, {
      vacancy_title: 'Senior Backend Engineer',
      vacancy_country: 'IL',
      vacancy_work_mode: WorkModeEnum.HYBRID
    });
    const kyiv = await insertVacancy(database, source.source_id, {
      vacancy_title: 'Frontend Engineer',
      vacancy_country: 'UA',
      vacancy_work_mode: WorkModeEnum.REMOTE
    });

    await database.db
      .update(vacancies)
      .set({ vacancy_first_seen_at: sql`now() - interval '10 days'` })
      .where(sql`${vacancies.vacancy_id} = ${kyiv.vacancy_id}`);

    await expect(selected({ country: 'il' })).resolves.toEqual([haifa.vacancy_id]);
    await expect(selected({ workMode: WorkModeEnum.REMOTE })).resolves.toEqual([kyiv.vacancy_id]);
    await expect(selected({ title: 'BACKEND' })).resolves.toEqual([haifa.vacancy_id]);
    await expect(selected({ sinceDays: 7 })).resolves.toEqual([haifa.vacancy_id]);
    await expect(selected({ sinceDays: 11 })).resolves.toEqual([haifa.vacancy_id, kyiv.vacancy_id]);
  });

  it('selects by the company, case aside, and reads the links and the first sighting of each position', async () => {
    const source = await insertSource(database);
    const northwind = await insertVacancy(database, source.source_id, {
      vacancy_company: 'Northwind Traders',
      vacancy_text_url: 'https://boards.example.com/northwind/1'
    });

    await insertVacancy(database, source.source_id, { vacancy_company: 'Contoso' });

    const data = await repository.findAll({ company: 'NORTHWIND' });

    expect(data.vacancies).toHaveLength(1);
    expect(data.vacancies[0]).toMatchObject({
      vacancyId: northwind.vacancy_id,
      company: 'Northwind Traders',
      url: northwind.vacancy_url,
      textURL: 'https://boards.example.com/northwind/1',
      firstSeenAt: northwind.vacancy_first_seen_at
    });
  });

  it('combines the conditions: every one must hold', async () => {
    const source = await insertSource(database);
    const wanted = await insertVacancy(database, source.source_id, { vacancy_title: 'Backend Engineer', vacancy_country: 'IL' });

    await insertVacancy(database, source.source_id, { vacancy_title: 'Backend Engineer', vacancy_country: 'UA' });
    await insertVacancy(database, source.source_id, { vacancy_title: 'Designer', vacancy_country: 'IL' });

    await expect(selected({ title: 'backend', country: 'IL', stages: [VacancyStageEnum.LISTED] })).resolves.toEqual([wanted.vacancy_id]);
  });

  it('keeps the newest positions of each source up to the limit, after the other conditions', async () => {
    const first = await insertSource(database);
    const second = await insertSource(database);
    const firstIds: number[] = [];

    for (let count = 0; count < 3; count++) {
      firstIds.push((await insertVacancy(database, first.source_id)).vacancy_id);
    }

    const only = await insertVacancy(database, second.source_id);

    await insertVacancy(database, first.source_id, { vacancy_stage: VacancyStageEnum.CLOSED });

    await expect(selected({ limit: 2 })).resolves.toEqual([firstIds[1], firstIds[2], only.vacancy_id]);
  });

  describe('findPage', () => {
    const NEWEST: IVacancyReportPageRequest = { page: 1, pageSize: 25, sort: VacancySortEnum.FIRST_SEEN_AT, order: SortOrderEnum.DESC };
    let sourceId: number;

    /**
     * Ids of the page the filter selects
     *
     * @param {IVacancyReportFilter} filter
     * @param {IVacancyReportPageRequest} [request]
     *
     * @returns {Promise<number[]>}
     */
    async function page(filter: IVacancyReportFilter, request: IVacancyReportPageRequest = NEWEST): Promise<number[]> {
      return (await repository.findPage(filter, request)).vacancies.map(vacancy => vacancy.vacancyId);
    }

    beforeEach(async () => {
      sourceId = (await insertSource(database, { source_name: 'Northwind' })).source_id;
    });

    it('counts every position the filter selects and gives the page asked for, newest first among equals', async () => {
      const ids: number[] = [];

      for (let index = 0; index < 5; index += 1) {
        ids.push((await insertVacancy(database, sourceId, { vacancy_first_seen_at: new Date('2026-11-20T10:00:00Z') })).vacancy_id);
      }

      const second = await repository.findPage({}, { ...NEWEST, page: 2, pageSize: 2 });

      expect(second.total).toBe(5);
      expect(second.vacancies.map(vacancy => vacancy.vacancyId)).toEqual([ids[2], ids[1]]);
      await expect(repository.findPage({}, { ...NEWEST, page: 4, pageSize: 2 })).resolves.toMatchObject({ total: 5, vacancies: [] });
    });

    it('sorts by title or company in either direction', async () => {
      const beta = await insertVacancy(database, sourceId, { vacancy_title: 'Beta', vacancy_company: 'Contoso' });
      const alpha = await insertVacancy(database, sourceId, { vacancy_title: 'Alpha', vacancy_company: 'Northwind' });

      await expect(page({}, { ...NEWEST, sort: VacancySortEnum.TITLE, order: SortOrderEnum.ASC })).resolves.toEqual([
        alpha.vacancy_id,
        beta.vacancy_id
      ]);
      await expect(page({}, { ...NEWEST, sort: VacancySortEnum.COMPANY, order: SortOrderEnum.DESC })).resolves.toEqual([
        alpha.vacancy_id,
        beta.vacancy_id
      ]);
    });

    it('selects by several countries and levels, a city case aside and a text in the title or the company', async () => {
      const telAviv = await insertVacancy(database, sourceId, {
        vacancy_country: 'IL',
        vacancy_city: 'Tel Aviv',
        vacancy_level: SeniorityLevelEnum.SENIOR,
        vacancy_title: 'Platform Engineer'
      });
      const kyiv = await insertVacancy(database, sourceId, {
        vacancy_country: 'UA',
        vacancy_city: 'Kyiv',
        vacancy_level: SeniorityLevelEnum.STAFF,
        vacancy_company: 'Contoso'
      });
      const berlin = await insertVacancy(database, sourceId, { vacancy_country: 'DE', vacancy_level: SeniorityLevelEnum.SENIOR });
      const junior = await insertVacancy(database, sourceId, { vacancy_country: 'IL', vacancy_level: SeniorityLevelEnum.JUNIOR });

      await expect(page({ countries: ['il', 'UA'] })).resolves.toEqual([junior.vacancy_id, kyiv.vacancy_id, telAviv.vacancy_id]);
      await expect(page({ levels: [SeniorityLevelEnum.SENIOR, SeniorityLevelEnum.STAFF] })).resolves.toEqual([
        berlin.vacancy_id,
        kyiv.vacancy_id,
        telAviv.vacancy_id
      ]);
      await expect(page({ city: 'tel aviv' })).resolves.toEqual([telAviv.vacancy_id]);
      await expect(page({ query: 'contoso' })).resolves.toEqual([kyiv.vacancy_id]);
      await expect(page({ query: 'platform' })).resolves.toEqual([telAviv.vacancy_id]);
    });

    it('selects by the latest choice of the owner, "none" for a position never chosen', async () => {
      const applied = await insertVacancy(database, sourceId);
      const skippedThenInterested = await insertVacancy(database, sourceId);
      const untouched = await insertVacancy(database, sourceId);

      await insertAction(database, applied.vacancy_id, VacancyActionKindEnum.APPLIED);
      await insertAction(database, skippedThenInterested.vacancy_id, VacancyActionKindEnum.SKIPPED);
      await insertAction(database, skippedThenInterested.vacancy_id, VacancyActionKindEnum.INTERESTED);

      await expect(page({ lastActions: [VacancyLastActionEnum.SKIPPED] })).resolves.toEqual([]);
      await expect(page({ lastActions: [VacancyLastActionEnum.INTERESTED, VacancyLastActionEnum.NONE] })).resolves.toEqual([
        untouched.vacancy_id,
        skippedThenInterested.vacancy_id
      ]);

      const rows = (await repository.findPage({}, NEWEST)).vacancies;

      expect(rows.map(row => [row.vacancyId, row.lastAction])).toEqual([
        [untouched.vacancy_id, null],
        [skippedThenInterested.vacancy_id, VacancyActionKindEnum.INTERESTED],
        [applied.vacancy_id, VacancyActionKindEnum.APPLIED]
      ]);
    });

    it('reads the source name and the verdicts of the page against the current resumes with their findings', async () => {
      const { profileId, resumeId: older } = await insertProfileWithResume(database, 'developer', { isCurrent: false });
      const current = await insertResume(database, profileId);
      const vacancy = await insertVacancy(database, sourceId, { vacancy_stage: VacancyStageEnum.EXTRACTED });
      const reasons = [{ rule: MatchRuleEnum.EXPERIENCE, effect: VacancyMatchVerdictEnum.ALMOST, message: 'asks for 5 years' }];

      await insertMatch(database, vacancy.vacancy_id, older, { vacancy_match_verdict: VacancyMatchVerdictEnum.FIT });
      await insertMatch(database, vacancy.vacancy_id, current, {
        vacancy_match_verdict: VacancyMatchVerdictEnum.ALMOST,
        vacancy_match_reasons: reasons
      });

      const result = await repository.findPage({ verdicts: [VacancyMatchVerdictEnum.ALMOST] }, NEWEST);

      expect(result.vacancies[0]?.sourceName).toBe('Northwind');
      expect(result.matches).toEqual([
        { vacancyId: vacancy.vacancy_id, profileName: 'developer', verdict: VacancyMatchVerdictEnum.ALMOST, reasons }
      ]);
    });

    it('hides closed positions unless asked, as the report does', async () => {
      const closed = await insertVacancy(database, sourceId, { vacancy_stage: VacancyStageEnum.CLOSED });
      const open = await insertVacancy(database, sourceId);

      await expect(page({})).resolves.toEqual([open.vacancy_id]);
      await expect(page({ closed: true })).resolves.toEqual([open.vacancy_id, closed.vacancy_id]);
    });
  });
});
