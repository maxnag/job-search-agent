import { describe, expect, it } from 'vitest';

import { HebrewRequirementEnum, VacancyMatchVerdictEnum } from '@job-agent/shared';

import type { IVacancyData } from '../../../vacancies/interfaces/vacancy-data.interface.js';
import { MatchRuleEnum } from '../../enums/match-rule.enum.js';
import { hebrewRule } from './hebrew.rule.js';

/**
 * A vacancy with the given Hebrew requirement
 *
 * @param {HebrewRequirementEnum} hebrew
 *
 * @returns {IVacancyData}
 */
function vacancy(hebrew: HebrewRequirementEnum): IVacancyData {
  return {
    title: 'Backend Developer',
    company: 'Northwind',
    level: null,
    country: 'IL',
    city: null,
    workMode: null,
    requiredLanguages: [],
    preferredLanguages: [],
    frameworks: [],
    yearsRequired: null,
    hebrew,
    summary: '',
    model: 'test'
  };
}

describe('hebrewRule', () => {
  it('drops a vacancy that requires Hebrew', () => {
    expect(hebrewRule(vacancy(HebrewRequirementEnum.REQUIRED))).toEqual({
      rule: MatchRuleEnum.HEBREW,
      effect: VacancyMatchVerdictEnum.NO_FIT,
      message: 'Hebrew is required'
    });
  });

  it('only marks a vacancy where Hebrew is an advantage, keeping it a fit', () => {
    expect(hebrewRule(vacancy(HebrewRequirementEnum.ADVANTAGE))).toEqual({
      rule: MatchRuleEnum.HEBREW,
      effect: VacancyMatchVerdictEnum.FIT,
      message: 'Hebrew is an advantage'
    });
  });

  it('says nothing when the vacancy does not mention Hebrew', () => {
    expect(hebrewRule(vacancy(HebrewRequirementEnum.NONE))).toBeUndefined();
  });
});
