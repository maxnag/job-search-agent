import { describe, expect, it } from 'vitest';

import { HebrewRequirementEnum, VacancyMatchVerdictEnum } from '@job-agent/shared';

import type { IVacancyData, IVacancySkill } from '../../../vacancies/interfaces/vacancy-data.interface.js';
import { MatchRuleEnum } from '../../enums/match-rule.enum.js';
import type { IResumeFacts } from '../../interfaces/resume-facts.interface.js';
import { languagesRule } from './languages.rule.js';

const TYPESCRIPT: IVacancySkill = { key: 'typescript', name: 'TypeScript', isUnknown: false };
const JAVA: IVacancySkill = { key: 'java', name: 'Java', isUnknown: false };
const PYTHON: IVacancySkill = { key: 'python', name: 'Python', isUnknown: false };
const RESUME: IResumeFacts = { skillKeys: new Set(['typescript', 'javascript', 'php']), experienceYears: 10 };

/**
 * A vacancy with the given required and preferred languages
 *
 * @param {IVacancySkill[]} requiredLanguages
 * @param {IVacancySkill[]} preferredLanguages
 *
 * @returns {IVacancyData}
 */
function asking(requiredLanguages: IVacancySkill[], preferredLanguages: IVacancySkill[] = []): IVacancyData {
  return {
    title: 'Backend Developer',
    company: 'Northwind',
    level: null,
    country: 'IL',
    city: null,
    workMode: null,
    requiredLanguages,
    preferredLanguages,
    frameworks: [],
    yearsRequired: null,
    hebrew: HebrewRequirementEnum.NONE,
    summary: '',
    model: 'test'
  };
}

describe('languagesRule', () => {
  it('is a fit when the resume has a required language, naming the ones it has', () => {
    expect(languagesRule(asking([TYPESCRIPT, JAVA]), RESUME)).toEqual({
      rule: MatchRuleEnum.LANGUAGES,
      effect: VacancyMatchVerdictEnum.FIT,
      message: 'matches TypeScript',
      params: { matched: ['TypeScript'] }
    });
  });

  it('is no fit when the resume has none of the required languages', () => {
    expect(languagesRule(asking([JAVA, PYTHON]), RESUME)).toEqual({
      rule: MatchRuleEnum.LANGUAGES,
      effect: VacancyMatchVerdictEnum.NO_FIT,
      message: 'asks for Java, Python — none of them in the resume',
      params: { asked: ['java', 'python'] }
    });
  });

  it('judges by the required languages only when there are some, a matching preferred one aside', () => {
    expect(languagesRule(asking([JAVA], [TYPESCRIPT]), RESUME).effect).toBe(VacancyMatchVerdictEnum.NO_FIT);
  });

  it('judges by the preferred languages when none is required', () => {
    expect(languagesRule(asking([], [TYPESCRIPT]), RESUME)).toMatchObject({
      effect: VacancyMatchVerdictEnum.FIT,
      message: 'matches TypeScript'
    });
    expect(languagesRule(asking([], [JAVA]), RESUME).effect).toBe(VacancyMatchVerdictEnum.NO_FIT);
  });

  it('is almost when the vacancy names no programming language', () => {
    expect(languagesRule(asking([]), RESUME)).toEqual({
      rule: MatchRuleEnum.LANGUAGES,
      effect: VacancyMatchVerdictEnum.ALMOST,
      message: 'the vacancy names no programming language'
    });
  });
});
