import { describe, expect, it } from 'vitest';

import { VacancyMatchVerdictEnum } from '@job-agent/shared';

import type { ProfilePreferencesType } from '../../../vacancies/schemas/profile-preferences.schema.js';
import { MatchRuleEnum } from '../../enums/match-rule.enum.js';
import type { IPositionFacts } from '../../interfaces/position-facts.interface.js';
import { companyRule } from './company.rule.js';

const FACTS: IPositionFacts = { company: 'Northwind Ltd', roleFamily: null, level: null, country: null, city: null, workMode: null };

/**
 * Preferences that exclude the given companies
 *
 * @param {string[]} excluded
 *
 * @returns {ProfilePreferencesType}
 */
function excluding(...excluded: string[]): ProfilePreferencesType {
  return { role_families: [], places: [], excluded_companies: excluded };
}

describe('companyRule', () => {
  it('drops an excluded company, compared by its normalized name', () => {
    expect(companyRule(FACTS, excluding('NORTHWIND INC.'))).toEqual({
      rule: MatchRuleEnum.COMPANY,
      effect: VacancyMatchVerdictEnum.NO_FIT,
      message: 'company Northwind Ltd is excluded'
    });
  });

  it('leaves a company nobody excluded alone', () => {
    expect(companyRule(FACTS, excluding('Contoso'))).toBeUndefined();
  });

  it('leaves a company alone when nothing is excluded', () => {
    expect(companyRule(FACTS, excluding())).toBeUndefined();
  });

  it('does not take a company for an excluded one that only starts the same way', () => {
    expect(companyRule({ ...FACTS, company: 'Northwind Traders' }, excluding('Northwind'))).toBeUndefined();
  });
});
