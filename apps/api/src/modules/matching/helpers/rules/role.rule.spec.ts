import { describe, expect, it } from 'vitest';

import { RoleFamilyEnum, VacancyMatchVerdictEnum } from '@job-agent/shared';

import type { ProfilePreferencesType } from '../../../vacancies/schemas/profile-preferences.schema.js';
import { MatchRuleEnum } from '../../enums/match-rule.enum.js';
import type { IPositionFacts } from '../../interfaces/position-facts.interface.js';
import { roleRule } from './role.rule.js';

/**
 * Facts of a position of the given role family
 *
 * @param {RoleFamilyEnum | null} roleFamily
 *
 * @returns {IPositionFacts}
 */
function role(roleFamily: RoleFamilyEnum | null): IPositionFacts {
  return { company: 'Northwind', roleFamily, level: null, country: null, city: null, workMode: null };
}

/**
 * Preferences that search the given role families
 *
 * @param {RoleFamilyEnum[]} families
 *
 * @returns {ProfilePreferencesType}
 */
function searching(...families: RoleFamilyEnum[]): ProfilePreferencesType {
  return { role_families: families, places: [], excluded_companies: [] };
}

describe('roleRule', () => {
  it('drops a role family the profile does not search', () => {
    expect(roleRule(role(RoleFamilyEnum.QA), searching(RoleFamilyEnum.BACKEND, RoleFamilyEnum.FULL_STACK))).toEqual({
      rule: MatchRuleEnum.ROLE,
      effect: VacancyMatchVerdictEnum.NO_FIT,
      message: 'role qa is not searched'
    });
  });

  it('keeps a searched role family', () => {
    expect(roleRule(role(RoleFamilyEnum.FULL_STACK), searching(RoleFamilyEnum.BACKEND, RoleFamilyEnum.FULL_STACK))).toBeUndefined();
  });

  it('keeps every role when the profile names none', () => {
    expect(roleRule(role(RoleFamilyEnum.OTHER), searching())).toBeUndefined();
  });

  it('keeps a position whose role is unknown', () => {
    expect(roleRule(role(null), searching(RoleFamilyEnum.BACKEND))).toBeUndefined();
  });
});
