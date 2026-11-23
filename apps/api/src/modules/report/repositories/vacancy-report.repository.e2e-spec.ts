import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { truncateTables } from '@job-agent/db';
import { SourceFetchModeEnum, SourceStatusEnum, VacancyMatchVerdictEnum, VacancyStageEnum } from '@job-agent/shared';

import { testDatabaseProvider } from '../../../../test/test-database.provider.js';
import {
  PIPELINE_TABLES,
  insertMatch,
  insertProfileWithResume,
  insertResume,
  insertSource,
  insertVacancy
} from '../../../../test/vacancy-fixtures.js';
import { DatabaseService } from '../../database/services/database.service.js';
import { MatchRuleEnum } from '../../matching/enums/match-rule.enum.js';
import { VacancyReportRepository } from './vacancy-report.repository.js';

describe('VacancyReportRepository (e2e)', () => {
  let moduleFixture: TestingModule;
  let repository: VacancyReportRepository;
  let database: DatabaseService;

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

    const data = await repository.findAll(wanted.source_id);

    expect(data.sources.map(source => source.sourceId)).toEqual([wanted.source_id]);
    expect(data.vacancies.map(row => row.vacancyId)).toEqual([vacancy.vacancy_id]);
  });
});
