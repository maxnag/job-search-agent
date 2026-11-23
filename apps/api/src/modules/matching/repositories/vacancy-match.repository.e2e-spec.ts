import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { truncateTables, vacancyMatches } from '@job-agent/db';
import { VacancyMatchVerdictEnum, VacancyStageEnum } from '@job-agent/shared';

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
import { MatchRuleEnum } from '../enums/match-rule.enum.js';
import { VacancyMatchRepository } from './vacancy-match.repository.js';

describe('VacancyMatchRepository (e2e)', () => {
  let moduleFixture: TestingModule;
  let repository: VacancyMatchRepository;
  let database: DatabaseService;
  let sourceId: number;

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({ providers: [VacancyMatchRepository, testDatabaseProvider()] }).compile();
    repository = moduleFixture.get(VacancyMatchRepository);
    database = moduleFixture.get(DatabaseService);
  });

  beforeEach(async () => {
    await truncateTables(database.db, PIPELINE_TABLES);
    sourceId = (await insertSource(database)).source_id;
  });

  afterAll(async () => {
    await moduleFixture.close();
  });

  describe('upsert', () => {
    it('stores a verdict with its findings', async () => {
      const { resumeId } = await insertProfileWithResume(database, 'developer');
      const vacancy = await insertVacancy(database, sourceId);
      const reasons = [
        {
          rule: MatchRuleEnum.LANGUAGES,
          effect: VacancyMatchVerdictEnum.FIT,
          message: 'matches TypeScript',
          params: { matched: ['TypeScript'] }
        }
      ];

      const stored = await repository.upsert({ vacancyId: vacancy.vacancy_id, resumeId, verdict: VacancyMatchVerdictEnum.FIT, reasons });

      expect(stored).toEqual({ vacancyMatchId: expect.any(Number) as number, verdict: VacancyMatchVerdictEnum.FIT, notifiedAt: null });

      const [row] = await database.db.select().from(vacancyMatches);

      expect(row?.vacancy_match_reasons).toEqual(reasons);
    });

    it('replaces the verdict of the same vacancy and resume, keeping the card time', async () => {
      const { resumeId } = await insertProfileWithResume(database, 'developer');
      const vacancy = await insertVacancy(database, sourceId);
      const toldAt = new Date('2026-11-20T10:00:00Z');
      const matchId = await insertMatch(database, vacancy.vacancy_id, resumeId, { vacancy_match_notified_at: toldAt });

      const stored = await repository.upsert({
        vacancyId: vacancy.vacancy_id,
        resumeId,
        verdict: VacancyMatchVerdictEnum.NO_FIT,
        reasons: []
      });

      expect(stored).toEqual({ vacancyMatchId: matchId, verdict: VacancyMatchVerdictEnum.NO_FIT, notifiedAt: toldAt });
      await expect(database.db.select().from(vacancyMatches)).resolves.toHaveLength(1);
    });
  });

  it('gives the first card time per vacancy across every resume of a profile', async () => {
    const { profileId, resumeId: older } = await insertProfileWithResume(database, 'developer', { isCurrent: false });
    const current = await insertResume(database, profileId);
    const other = await insertProfileWithResume(database, 'cook');
    const told = await insertVacancy(database, sourceId);
    const untold = await insertVacancy(database, sourceId);
    const first = new Date('2026-11-10T10:00:00Z');

    await insertMatch(database, told.vacancy_id, older, { vacancy_match_notified_at: first });
    await insertMatch(database, told.vacancy_id, current, { vacancy_match_notified_at: new Date('2026-11-20T10:00:00Z') });
    await insertMatch(database, untold.vacancy_id, current);
    await insertMatch(database, untold.vacancy_id, other.resumeId, { vacancy_match_notified_at: first });

    const notifiedAt = await repository.findNotifiedAt(profileId);

    expect([...notifiedAt.entries()]).toEqual([[told.vacancy_id, first]]);
    expect(notifiedAt.get(told.vacancy_id)).toBeInstanceOf(Date);
  });

  it('marks a match as told at the given time', async () => {
    const { resumeId } = await insertProfileWithResume(database, 'developer');
    const vacancy = await insertVacancy(database, sourceId);
    const matchId = await insertMatch(database, vacancy.vacancy_id, resumeId);
    const toldAt = new Date('2026-11-20T10:00:00Z');

    await repository.markNotified(matchId, toldAt);

    const [row] = await database.db.select().from(vacancyMatches);

    expect(row?.vacancy_match_notified_at).toEqual(toldAt);
  });

  it('lists the extracted vacancies only', async () => {
    const extracted = await insertVacancy(database, sourceId, { vacancy_stage: VacancyStageEnum.EXTRACTED });

    await insertVacancy(database, sourceId);
    await insertVacancy(database, sourceId, { vacancy_stage: VacancyStageEnum.CLOSED });

    expect((await repository.findExtractedVacancies()).map(row => row.vacancy_id)).toEqual([extracted.vacancy_id]);
  });
});
