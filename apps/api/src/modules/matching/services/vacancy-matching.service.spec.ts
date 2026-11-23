import { type DeepMocked, createMock } from '@golevelup/ts-vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { HebrewRequirementEnum, VacancyMatchVerdictEnum } from '@job-agent/shared';

import type { IVacancyData } from '../../vacancies/interfaces/vacancy-data.interface.js';
import type { VacancyRowType } from '../../vacancies/interfaces/vacancy-row.interface.js';
import type { IMatchProfile } from '../interfaces/match-profile.interface.js';
import type { IVacancyMatchWrite } from '../interfaces/vacancy-match-write.interface.js';
import { MatchProfileRepository } from '../repositories/match-profile.repository.js';
import { VacancyMatchRepository } from '../repositories/vacancy-match.repository.js';
import { VacancyMatchingService } from './vacancy-matching.service.js';

const PROFILE: IMatchProfile = {
  profileId: 3,
  profileName: 'developer',
  preferences: {},
  resumeId: 12,
  experienceYears: 10,
  skillKeys: ['typescript']
};

/**
 * Stored extraction asking for the given language
 *
 * @param {string} key
 *
 * @returns {IVacancyData}
 */
function asking(key: string): IVacancyData {
  return {
    title: 'Backend Developer',
    company: 'Northwind',
    level: null,
    country: null,
    city: null,
    workMode: null,
    requiredLanguages: [{ key, name: key, isUnknown: false }],
    preferredLanguages: [],
    frameworks: [],
    yearsRequired: null,
    hebrew: HebrewRequirementEnum.NONE,
    summary: '',
    model: 'm'
  };
}

/**
 * An extracted vacancy
 *
 * @param {number} vacancyId
 * @param {Record<string, unknown> | null} data
 *
 * @returns {VacancyRowType}
 */
function vacancy(vacancyId: number, data: Record<string, unknown> | null): VacancyRowType {
  return { vacancy_id: vacancyId, vacancy_company: 'Northwind', vacancy_data: data } as VacancyRowType;
}

const FIT = vacancy(1, { ...asking('typescript') });
const NO_FIT = vacancy(2, { ...asking('java') });

describe('VacancyMatchingService (unit)', () => {
  let moduleFixture: TestingModule;
  let subjectUnderTest: VacancyMatchingService;
  let profiles: DeepMocked<MatchProfileRepository>;
  let matches: DeepMocked<VacancyMatchRepository>;

  beforeEach(async () => {
    profiles = createMock<MatchProfileRepository>();
    matches = createMock<VacancyMatchRepository>();
    profiles.findCurrent.mockResolvedValue([PROFILE]);
    matches.findNotifiedAt.mockResolvedValue(new Map());
    matches.upsert.mockImplementation((match: IVacancyMatchWrite) =>
      Promise.resolve({ vacancyMatchId: 100 + match.vacancyId, verdict: match.verdict, notifiedAt: null })
    );
    moduleFixture = await Test.createTestingModule({
      providers: [
        VacancyMatchingService,
        { provide: MatchProfileRepository, useValue: profiles },
        { provide: VacancyMatchRepository, useValue: matches }
      ]
    }).compile();

    subjectUnderTest = moduleFixture.get(VacancyMatchingService);
  });

  afterEach(async () => {
    await moduleFixture.close();
  });

  it('should be defined', () => {
    expect(subjectUnderTest).toBeDefined();
  });

  describe('matchVacancy', () => {
    it('matches the vacancy against the current resume of every profile and stores the verdict', async () => {
      const run = await subjectUnderTest.matchVacancy(FIT);

      expect(profiles.findCurrent).toHaveBeenCalledWith();
      expect(matches.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ vacancyId: 1, resumeId: 12, verdict: VacancyMatchVerdictEnum.FIT })
      );
      expect(run).toEqual({ verdicts: { fit: 1, almost: 0, no_fit: 0 }, notifiableMatchIds: [101], unreadable: 0 });
    });

    it('does not announce a no fit', async () => {
      await expect(subjectUnderTest.matchVacancy(NO_FIT)).resolves.toMatchObject({ verdicts: { no_fit: 1 }, notifiableMatchIds: [] });
    });

    it('does not announce a match the owner already got a card for', async () => {
      matches.upsert.mockResolvedValue({ vacancyMatchId: 101, verdict: VacancyMatchVerdictEnum.FIT, notifiedAt: new Date() });

      await expect(subjectUnderTest.matchVacancy(FIT)).resolves.toMatchObject({ notifiableMatchIds: [] });
    });

    it('carries the card time of an older resume over instead of announcing the vacancy again', async () => {
      const toldAt = new Date('2026-11-20T10:00:00Z');

      matches.findNotifiedAt.mockResolvedValue(new Map([[1, toldAt]]));

      await expect(subjectUnderTest.matchVacancy(FIT)).resolves.toMatchObject({ notifiableMatchIds: [] });
      expect(matches.findNotifiedAt).toHaveBeenCalledWith(3);
      expect(matches.markNotified).toHaveBeenCalledWith(101, toldAt);
    });

    it('counts a vacancy with unreadable data and leaves it unmatched', async () => {
      await expect(subjectUnderTest.matchVacancy(vacancy(5, { old: true }))).resolves.toEqual({
        verdicts: { fit: 0, almost: 0, no_fit: 0 },
        notifiableMatchIds: [],
        unreadable: 1
      });
      expect(matches.upsert).not.toHaveBeenCalled();
    });

    it('matches nothing without a profile', async () => {
      profiles.findCurrent.mockResolvedValue([]);

      await expect(subjectUnderTest.matchVacancy(FIT)).resolves.toMatchObject({ verdicts: { fit: 0, almost: 0, no_fit: 0 } });
    });

    it('refuses invalid preferences of a profile', async () => {
      profiles.findCurrent.mockResolvedValue([{ ...PROFILE, preferences: { min_level: 'guru' } }]);

      await expect(subjectUnderTest.matchVacancy(FIT)).rejects.toThrow('PROFILE_PREFERENCES_INVALID');
    });
  });

  describe('matchProfile', () => {
    it('matches every extracted vacancy against the current resume of one profile', async () => {
      matches.findExtractedVacancies.mockResolvedValue([FIT, NO_FIT]);

      const run = await subjectUnderTest.matchProfile(3);

      expect(profiles.findCurrent).toHaveBeenCalledWith(3);
      expect(run).toEqual({ verdicts: { fit: 1, almost: 0, no_fit: 1 }, notifiableMatchIds: [101], unreadable: 0 });
    });
  });
});
