import { describe, expect, it } from 'vitest';

import { HebrewRequirementEnum, RoleFamilyEnum, SeniorityLevelEnum, VacancyMatchVerdictEnum, WorkModeEnum } from '@job-agent/shared';

import type { IVacancyData } from '../../vacancies/interfaces/vacancy-data.interface.js';
import type { ProfilePreferencesType } from '../../vacancies/schemas/profile-preferences.schema.js';
import { MatchRuleEnum } from '../enums/match-rule.enum.js';
import type { IPositionFacts } from '../interfaces/position-facts.interface.js';
import type { IResumeFacts } from '../interfaces/resume-facts.interface.js';
import { matchVacancy, screenPosition } from './vacancy-match.helper.js';

const PREFERENCES: ProfilePreferencesType = {
  role_families: [RoleFamilyEnum.BACKEND, RoleFamilyEnum.FULL_STACK],
  min_level: SeniorityLevelEnum.SENIOR,
  places: [{ country: 'IL', work_modes: [WorkModeEnum.HYBRID, WorkModeEnum.REMOTE], excluded_cities: [] }],
  excluded_companies: ['Contoso']
};

const RESUME: IResumeFacts = { skillKeys: new Set(['typescript']), experienceYears: 10 };

const FITTING: IVacancyData = {
  title: 'Senior Backend Developer',
  company: 'Northwind',
  level: SeniorityLevelEnum.SENIOR,
  country: 'IL',
  city: 'Haifa',
  workMode: WorkModeEnum.HYBRID,
  requiredLanguages: [{ key: 'typescript', name: 'TypeScript', isUnknown: false }],
  preferredLanguages: [],
  frameworks: [],
  yearsRequired: 5,
  hebrew: HebrewRequirementEnum.NONE,
  summary: '',
  model: 'test'
};

const POSITION: IPositionFacts = {
  company: 'Northwind',
  roleFamily: RoleFamilyEnum.BACKEND,
  level: SeniorityLevelEnum.SENIOR,
  country: 'IL',
  city: 'Haifa',
  workMode: WorkModeEnum.HYBRID
};

describe('screenPosition', () => {
  it('finds nothing in a position every listing rule keeps', () => {
    expect(screenPosition(POSITION, PREFERENCES)).toEqual([]);
  });

  it('reports every failing listing rule in the order company, role, level, place', () => {
    const position: IPositionFacts = {
      company: 'Contoso Ltd',
      roleFamily: RoleFamilyEnum.QA,
      level: SeniorityLevelEnum.JUNIOR,
      country: 'US',
      city: null,
      workMode: null
    };

    expect(screenPosition(position, PREFERENCES).map(reason => reason.rule)).toEqual([
      MatchRuleEnum.COMPANY,
      MatchRuleEnum.ROLE,
      MatchRuleEnum.LEVEL,
      MatchRuleEnum.PLACE
    ]);
  });
});

describe('matchVacancy', () => {
  it('is a fit when no finding lowers it, with the findings that mark it', () => {
    const result = matchVacancy(FITTING, 'Northwind', PREFERENCES, RESUME);

    expect(result.verdict).toBe(VacancyMatchVerdictEnum.FIT);
    expect(result.reasons).toEqual([
      {
        rule: MatchRuleEnum.LANGUAGES,
        effect: VacancyMatchVerdictEnum.FIT,
        message: 'matches TypeScript',
        params: { matched: ['TypeScript'] }
      }
    ]);
  });

  it('is almost when the worst finding is almost', () => {
    const result = matchVacancy({ ...FITTING, yearsRequired: 12 }, 'Northwind', PREFERENCES, RESUME);

    expect(result.verdict).toBe(VacancyMatchVerdictEnum.ALMOST);
  });

  it('is no fit when any finding is no fit, an almost one aside', () => {
    const result = matchVacancy(
      { ...FITTING, yearsRequired: 12, hebrew: HebrewRequirementEnum.REQUIRED },
      'Northwind',
      PREFERENCES,
      RESUME
    );

    expect(result.verdict).toBe(VacancyMatchVerdictEnum.NO_FIT);
    expect(result.reasons.map(reason => reason.rule)).toEqual([MatchRuleEnum.LANGUAGES, MatchRuleEnum.HEBREW, MatchRuleEnum.EXPERIENCE]);
  });

  it('keeps a fit when Hebrew is only an advantage', () => {
    expect(matchVacancy({ ...FITTING, hebrew: HebrewRequirementEnum.ADVANTAGE }, 'Northwind', PREFERENCES, RESUME).verdict).toBe(
      VacancyMatchVerdictEnum.FIT
    );
  });

  it('applies the listing rules to the extracted place, level and the given company', () => {
    expect(matchVacancy({ ...FITTING, country: 'US' }, 'Northwind', PREFERENCES, RESUME).verdict).toBe(VacancyMatchVerdictEnum.NO_FIT);
    expect(matchVacancy({ ...FITTING, level: SeniorityLevelEnum.MIDDLE }, 'Northwind', PREFERENCES, RESUME).verdict).toBe(
      VacancyMatchVerdictEnum.NO_FIT
    );
    expect(matchVacancy(FITTING, 'Contoso', PREFERENCES, RESUME).verdict).toBe(VacancyMatchVerdictEnum.NO_FIT);
  });

  it('does not judge the role again — the listing already did', () => {
    const preferences: ProfilePreferencesType = { ...PREFERENCES, role_families: [RoleFamilyEnum.QA] };

    expect(matchVacancy(FITTING, 'Northwind', preferences, RESUME).verdict).toBe(VacancyMatchVerdictEnum.FIT);
  });
});
