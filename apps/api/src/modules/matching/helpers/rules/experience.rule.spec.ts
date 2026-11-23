import { describe, expect, it } from 'vitest';

import { HebrewRequirementEnum, VacancyMatchVerdictEnum } from '@job-agent/shared';

import type { IVacancyData } from '../../../vacancies/interfaces/vacancy-data.interface.js';
import { MatchRuleEnum } from '../../enums/match-rule.enum.js';
import type { IResumeFacts } from '../../interfaces/resume-facts.interface.js';
import { experienceRule } from './experience.rule.js';

/**
 * A vacancy that asks for the given years
 *
 * @param {number | null} yearsRequired
 *
 * @returns {IVacancyData}
 */
function asking(yearsRequired: number | null): IVacancyData {
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
    yearsRequired,
    hebrew: HebrewRequirementEnum.NONE,
    summary: '',
    model: 'test'
  };
}

/**
 * A resume with the given years
 *
 * @param {number | null} experienceYears
 *
 * @returns {IResumeFacts}
 */
function having(experienceYears: number | null): IResumeFacts {
  return { skillKeys: new Set(), experienceYears };
}

describe('experienceRule', () => {
  it('marks a vacancy that asks for more years than the resume has as almost', () => {
    expect(experienceRule(asking(8), having(7))).toEqual({
      rule: MatchRuleEnum.EXPERIENCE,
      effect: VacancyMatchVerdictEnum.ALMOST,
      message: 'requires 8+ years',
      params: { required: 8 }
    });
  });

  it('keeps a vacancy that asks for exactly the years of the resume', () => {
    expect(experienceRule(asking(7), having(7))).toBeUndefined();
  });

  it('keeps a vacancy that asks for fewer years', () => {
    expect(experienceRule(asking(3), having(7))).toBeUndefined();
  });

  it('says nothing when the vacancy names no years', () => {
    expect(experienceRule(asking(null), having(7))).toBeUndefined();
  });

  it('says nothing when the resume years are unknown', () => {
    expect(experienceRule(asking(5), having(null))).toBeUndefined();
  });

  it('keeps a vacancy that asks for zero years', () => {
    expect(experienceRule(asking(0), having(0))).toBeUndefined();
  });
});
