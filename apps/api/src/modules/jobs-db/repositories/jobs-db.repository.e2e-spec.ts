import { Test, type TestingModule } from '@nestjs/testing';
import { type AnyColumn, type SQL, eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { sourceCandidates, truncateTables, vacancies, vacancyActions, vacancyMatches } from '@job-agent/db';
import {
  ATSKindEnum,
  SourceCandidateStatusEnum,
  SourceFetchModeEnum,
  SourceStatusEnum,
  VacancyActionKindEnum,
  VacancyMatchVerdictEnum,
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
import { JobsDBRepository } from './jobs-db.repository.js';

const REASONS = [{ rule: MatchRuleEnum.HEBREW, effect: VacancyMatchVerdictEnum.NO_FIT, message: 'requires Hebrew' }];

describe('JobsDBRepository (e2e)', () => {
  let moduleFixture: TestingModule;
  let repository: JobsDBRepository;
  let database: DatabaseService;

  /**
   * Move the moment in a column of the rows a condition selects some days back
   *
   * @param {typeof vacancies | typeof vacancyActions | typeof vacancyMatches} table
   * @param {AnyColumn} column
   * @param {SQL} where
   * @param {number} days
   *
   * @returns {Promise<void>}
   */
  async function age(
    table: typeof vacancies | typeof vacancyActions | typeof vacancyMatches,
    column: AnyColumn,
    where: SQL,
    days: number
  ): Promise<void> {
    await database.db.execute(
      sql`UPDATE ${table} SET ${sql.identifier(column.name)} = now() - make_interval(days => ${days}) WHERE ${where}`
    );
  }

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({ providers: [JobsDBRepository, testDatabaseProvider()] }).compile();
    repository = moduleFixture.get(JobsDBRepository);
    database = moduleFixture.get(DatabaseService);
  });

  beforeEach(async () => {
    await truncateTables(database.db, [...PIPELINE_TABLES, sourceCandidates]);
  });

  afterAll(async () => {
    await moduleFixture.close();
  });

  describe('findVacancy', () => {
    it('reads a vacancy with the name of its source and its extraction', async () => {
      const source = await insertSource(database, { source_name: 'Northwind careers' });
      const vacancy = await insertVacancy(database, source.source_id, {
        vacancy_stage: VacancyStageEnum.EXTRACTED,
        vacancy_city: 'Haifa',
        vacancy_country: 'IL',
        vacancy_work_mode: WorkModeEnum.HYBRID,
        vacancy_text_url: 'https://boards.example.com/northwind/1',
        vacancy_data: { skills: ['TypeScript'] }
      });

      await expect(repository.findVacancy(vacancy.vacancy_id)).resolves.toEqual({
        vacancyId: vacancy.vacancy_id,
        sourceName: 'Northwind careers',
        title: 'Backend Developer',
        company: 'Northwind',
        city: 'Haifa',
        country: 'IL',
        workMode: WorkModeEnum.HYBRID,
        roleFamily: null,
        level: null,
        stage: VacancyStageEnum.EXTRACTED,
        skipReason: null,
        url: vacancy.vacancy_url,
        textURL: 'https://boards.example.com/northwind/1',
        data: { skills: ['TypeScript'] },
        firstSeenAt: vacancy.vacancy_first_seen_at,
        lastSeenAt: vacancy.vacancy_last_seen_at,
        closedAt: null
      });
    });

    it('gives nothing for an id that does not exist', async () => {
      await expect(repository.findVacancy(999)).resolves.toBeUndefined();
    });
  });

  describe('findVacancyMatches', () => {
    it('reads the verdicts against the current resume of each profile, by profile name', async () => {
      const source = await insertSource(database);
      const vacancy = await insertVacancy(database, source.source_id);
      const other = await insertVacancy(database, source.source_id);
      const { profileId, resumeId: older } = await insertProfileWithResume(database, 'lead', { isCurrent: false });
      const lead = await insertResume(database, profileId);
      const { resumeId: developer } = await insertProfileWithResume(database, 'developer');
      const notifiedAt = new Date('2026-11-21T08:00:00.000Z');

      await insertMatch(database, vacancy.vacancy_id, lead, {
        vacancy_match_reasons: REASONS,
        vacancy_match_verdict: VacancyMatchVerdictEnum.NO_FIT
      });
      await insertMatch(database, vacancy.vacancy_id, older, { vacancy_match_verdict: VacancyMatchVerdictEnum.FIT });
      await insertMatch(database, vacancy.vacancy_id, developer, { vacancy_match_notified_at: notifiedAt });
      await insertMatch(database, other.vacancy_id, developer);

      await expect(repository.findVacancyMatches(vacancy.vacancy_id)).resolves.toEqual([
        { profileName: 'developer', verdict: VacancyMatchVerdictEnum.FIT, reasons: [], notifiedAt },
        { profileName: 'lead', verdict: VacancyMatchVerdictEnum.NO_FIT, reasons: REASONS, notifiedAt: null }
      ]);
    });
  });

  describe('findVacancyActions', () => {
    it('reads the choices about one vacancy, oldest first', async () => {
      const source = await insertSource(database);
      const vacancy = await insertVacancy(database, source.source_id);
      const other = await insertVacancy(database, source.source_id);

      await insertAction(database, vacancy.vacancy_id, VacancyActionKindEnum.INTERESTED);
      await insertAction(database, other.vacancy_id, VacancyActionKindEnum.SKIPPED);
      await insertAction(database, vacancy.vacancy_id, VacancyActionKindEnum.APPLIED);

      const actions = await repository.findVacancyActions(vacancy.vacancy_id);

      expect(actions.map(action => action.kind)).toEqual([VacancyActionKindEnum.INTERESTED, VacancyActionKindEnum.APPLIED]);
      expect(actions.every(action => action.at instanceof Date)).toBe(true);
    });
  });

  describe('findApplications', () => {
    it('lists each vacancy of the choice once with its latest such choice, newest first', async () => {
      const source = await insertSource(database);
      const first = await insertVacancy(database, source.source_id, { vacancy_title: 'Backend Developer' });
      const second = await insertVacancy(database, source.source_id, {
        vacancy_title: 'Frontend Developer',
        vacancy_stage: VacancyStageEnum.CLOSED,
        vacancy_closed_at: new Date('2026-11-25T08:00:00.000Z')
      });
      const skipped = await insertVacancy(database, source.source_id);

      await insertAction(database, first.vacancy_id, VacancyActionKindEnum.APPLIED);
      await age(vacancyActions, vacancyActions.dt_create, sql`true`, 3);
      await insertAction(database, second.vacancy_id, VacancyActionKindEnum.APPLIED);
      await age(vacancyActions, vacancyActions.dt_create, eq(vacancyActions.vacancy_id, second.vacancy_id), 2);
      await insertAction(database, first.vacancy_id, VacancyActionKindEnum.APPLIED);
      await insertAction(database, skipped.vacancy_id, VacancyActionKindEnum.SKIPPED);

      const applications = await repository.findApplications({ kind: VacancyActionKindEnum.APPLIED });

      expect(applications.map(row => [row.vacancyId, row.stage])).toEqual([
        [first.vacancy_id, VacancyStageEnum.LISTED],
        [second.vacancy_id, VacancyStageEnum.CLOSED]
      ]);
      expect(applications[0]).toMatchObject({ title: 'Backend Developer', company: 'Northwind', url: first.vacancy_url, closedAt: null });
      expect(applications[1]?.closedAt).toEqual(new Date('2026-11-25T08:00:00.000Z'));
      expect(Date.now() - (applications[0]?.at.getTime() ?? 0)).toBeLessThan(60_000);
    });

    it('keeps the choices within the period', async () => {
      const source = await insertSource(database);
      const recent = await insertVacancy(database, source.source_id);
      const old = await insertVacancy(database, source.source_id);

      await insertAction(database, recent.vacancy_id, VacancyActionKindEnum.INTERESTED);
      await insertAction(database, old.vacancy_id, VacancyActionKindEnum.INTERESTED);
      await age(vacancyActions, vacancyActions.dt_create, eq(vacancyActions.vacancy_id, old.vacancy_id), 10);

      const inWeek = await repository.findApplications({ kind: VacancyActionKindEnum.INTERESTED, sinceDays: 7 });
      const inMonth = await repository.findApplications({ kind: VacancyActionKindEnum.INTERESTED, sinceDays: 30 });

      expect(inWeek.map(row => row.vacancyId)).toEqual([recent.vacancy_id]);
      expect(inMonth.map(row => row.vacancyId)).toEqual([recent.vacancy_id, old.vacancy_id]);
    });
  });

  describe('countPipeline', () => {
    it('gives zeros on an empty database', async () => {
      await expect(repository.countPipeline()).resolves.toEqual({ byStage: [], byVerdict: [], bySource: [], actions: [], cardsSent: 0 });
    });

    it('counts the vacancies by stage, verdict and source, the choices and the cards — the period applied to each', async () => {
      const northwind = await insertSource(database, { source_name: 'Northwind' });
      const contoso = await insertSource(database, { source_name: 'Contoso' });
      const { profileId, resumeId: older } = await insertProfileWithResume(database, 'developer', { isCurrent: false });
      const current = await insertResume(database, profileId);
      const fit = await insertVacancy(database, northwind.source_id, { vacancy_stage: VacancyStageEnum.EXTRACTED });
      const noFit = await insertVacancy(database, northwind.source_id, { vacancy_stage: VacancyStageEnum.EXTRACTED });
      const skipped = await insertVacancy(database, contoso.source_id, { vacancy_stage: VacancyStageEnum.SKIPPED });
      const old = await insertVacancy(database, contoso.source_id, { vacancy_stage: VacancyStageEnum.EXTRACTED });

      await insertMatch(database, fit.vacancy_id, current, { vacancy_match_notified_at: new Date() });
      await insertMatch(database, fit.vacancy_id, older, { vacancy_match_verdict: VacancyMatchVerdictEnum.NO_FIT });
      await insertMatch(database, noFit.vacancy_id, current, { vacancy_match_verdict: VacancyMatchVerdictEnum.NO_FIT });
      await insertMatch(database, old.vacancy_id, current, { vacancy_match_notified_at: new Date() });
      await insertAction(database, fit.vacancy_id, VacancyActionKindEnum.APPLIED);
      await insertAction(database, skipped.vacancy_id, VacancyActionKindEnum.SKIPPED);
      await insertAction(database, old.vacancy_id, VacancyActionKindEnum.APPLIED);
      await age(vacancies, vacancies.vacancy_first_seen_at, eq(vacancies.vacancy_id, old.vacancy_id), 10);
      await age(vacancyActions, vacancyActions.dt_create, eq(vacancyActions.vacancy_id, old.vacancy_id), 10);
      await age(vacancyMatches, vacancyMatches.vacancy_match_notified_at, eq(vacancyMatches.vacancy_id, old.vacancy_id), 10);

      const week = await repository.countPipeline(7);

      expect(week.byStage).toHaveLength(2);
      expect(week.byStage).toEqual(
        expect.arrayContaining([
          { stage: VacancyStageEnum.SKIPPED, count: 1 },
          { stage: VacancyStageEnum.EXTRACTED, count: 2 }
        ])
      );
      expect(week.byVerdict).toHaveLength(2);
      expect(week.byVerdict).toEqual(
        expect.arrayContaining([
          { profileName: 'developer', verdict: VacancyMatchVerdictEnum.FIT, count: 1 },
          { profileName: 'developer', verdict: VacancyMatchVerdictEnum.NO_FIT, count: 1 }
        ])
      );
      expect(week.bySource).toEqual([
        { sourceId: northwind.source_id, name: 'Northwind', count: 2 },
        { sourceId: contoso.source_id, name: 'Contoso', count: 1 }
      ]);
      expect(week.actions).toHaveLength(2);
      expect(week.actions).toEqual(
        expect.arrayContaining([
          { kind: VacancyActionKindEnum.APPLIED, count: 1 },
          { kind: VacancyActionKindEnum.SKIPPED, count: 1 }
        ])
      );
      expect(week.cardsSent).toBe(1);

      const everything = await repository.countPipeline();

      expect(everything.byStage.reduce((sum, row) => sum + row.count, 0)).toBe(4);
      expect(everything.bySource).toEqual([
        { sourceId: northwind.source_id, name: 'Northwind', count: 2 },
        { sourceId: contoso.source_id, name: 'Contoso', count: 2 }
      ]);
      expect(everything.actions.find(row => row.kind === VacancyActionKindEnum.APPLIED)?.count).toBe(2);
      expect(everything.cardsSent).toBe(2);
    });
  });

  describe('findSources', () => {
    it('reads the switched-on sources with their open vacancies, a closed one not counted', async () => {
      const busy = await insertSource(database, {
        source_name: 'Northwind',
        source_status: SourceStatusEnum.BLOCKED,
        source_last_error: 'HTTP 403'
      });
      const quiet = await insertSource(database, { source_name: 'Contoso' });

      await insertSource(database, { source_name: 'Fabrikam', source_is_active: false });
      await insertVacancy(database, busy.source_id);
      await insertVacancy(database, busy.source_id, { vacancy_stage: VacancyStageEnum.SKIPPED });
      await insertVacancy(database, busy.source_id, { vacancy_stage: VacancyStageEnum.CLOSED });

      await expect(repository.findSources({})).resolves.toEqual([
        {
          sourceId: busy.source_id,
          name: 'Northwind',
          url: busy.source_url,
          fetchMode: SourceFetchModeEnum.HTML,
          isActive: true,
          status: SourceStatusEnum.BLOCKED,
          lastScanAt: null,
          lastError: 'HTTP 403',
          openVacancies: 2
        },
        {
          sourceId: quiet.source_id,
          name: 'Contoso',
          url: quiet.source_url,
          fetchMode: SourceFetchModeEnum.HTML,
          isActive: true,
          status: SourceStatusEnum.OK,
          lastScanAt: null,
          lastError: null,
          openVacancies: 0
        }
      ]);
    });

    it('adds the switched-off sources when asked and selects by status', async () => {
      const on = await insertSource(database, { source_status: SourceStatusEnum.OK });
      const off = await insertSource(database, { source_is_active: false, source_status: SourceStatusEnum.BLOCKED });

      const all = await repository.findSources({ includeInactive: true });
      const blocked = await repository.findSources({ includeInactive: true, status: SourceStatusEnum.BLOCKED });
      const blockedOn = await repository.findSources({ status: SourceStatusEnum.BLOCKED });

      expect(all.map(row => row.sourceId)).toEqual([on.source_id, off.source_id]);
      expect(blocked.map(row => row.sourceId)).toEqual([off.source_id]);
      expect(blockedOn).toEqual([]);
    });
  });

  describe('findSourceCandidates', () => {
    it('reads the boards, the latest checked first, of one status when asked', async () => {
      const values = {
        source_candidate_ats_kind: ATSKindEnum.GREENHOUSE,
        source_candidate_company: 'Northwind',
        source_candidate_positions: 10,
        source_candidate_matching: 2,
        source_candidate_unknown: 1,
        source_candidate_examples: ['Backend Engineer — Haifa']
      };
      const [older, newer, ignored] = await database.db
        .insert(sourceCandidates)
        .values([
          {
            ...values,
            source_candidate_board: 'northwind',
            source_candidate_status: SourceCandidateStatusEnum.PROPOSED,
            source_candidate_checked_at: new Date('2026-11-20T08:00:00.000Z')
          },
          {
            ...values,
            source_candidate_board: 'contoso',
            source_candidate_status: SourceCandidateStatusEnum.PROPOSED,
            source_candidate_checked_at: new Date('2026-11-24T08:00:00.000Z')
          },
          {
            ...values,
            source_candidate_board: 'fabrikam',
            source_candidate_status: SourceCandidateStatusEnum.IGNORED,
            source_candidate_checked_at: new Date('2026-11-22T08:00:00.000Z')
          }
        ])
        .returning();

      const all = await repository.findSourceCandidates();
      const proposed = await repository.findSourceCandidates(SourceCandidateStatusEnum.PROPOSED);

      expect(all.map(row => row.source_candidate_id)).toEqual([
        newer?.source_candidate_id,
        ignored?.source_candidate_id,
        older?.source_candidate_id
      ]);
      expect(proposed.map(row => row.source_candidate_board)).toEqual(['contoso', 'northwind']);
    });
  });
});
