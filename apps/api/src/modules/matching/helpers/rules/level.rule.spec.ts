import { describe, expect, it } from 'vitest';

import { SeniorityLevelEnum, VacancyMatchVerdictEnum } from '@job-agent/shared';

import type { ProfilePreferencesType } from '../../../vacancies/schemas/profile-preferences.schema.js';
import { MatchRuleEnum } from '../../enums/match-rule.enum.js';
import type { IPositionFacts } from '../../interfaces/position-facts.interface.js';
import { levelRule } from './level.rule.js';

/**
 * Facts of a position of the given level
 *
 * @param {SeniorityLevelEnum | null} level
 *
 * @returns {IPositionFacts}
 */
function level(level: SeniorityLevelEnum | null): IPositionFacts {
  return { company: 'Northwind', roleFamily: null, level, country: null, city: null, workMode: null };
}

/**
 * Preferences with the given lowest level
 *
 * @param {SeniorityLevelEnum} [minLevel]
 *
 * @returns {ProfilePreferencesType}
 */
function atLeast(minLevel?: SeniorityLevelEnum): ProfilePreferencesType {
  return { role_families: [], min_level: minLevel, places: [], excluded_companies: [] };
}

describe('levelRule', () => {
  it('drops a level below the lowest one, naming both', () => {
    expect(levelRule(level(SeniorityLevelEnum.MIDDLE), atLeast(SeniorityLevelEnum.SENIOR))).toEqual({
      rule: MatchRuleEnum.LEVEL,
      effect: VacancyMatchVerdictEnum.NO_FIT,
      message: 'level middle is below senior'
    });
  });

  it.each([SeniorityLevelEnum.INTERN, SeniorityLevelEnum.JUNIOR])('drops %s for a senior profile', value => {
    expect(levelRule(level(value), atLeast(SeniorityLevelEnum.SENIOR))?.effect).toBe(VacancyMatchVerdictEnum.NO_FIT);
  });

  it.each([SeniorityLevelEnum.SENIOR, SeniorityLevelEnum.STAFF, SeniorityLevelEnum.PRINCIPAL])(
    'keeps %s for a senior profile — the lowest level itself included',
    value => {
      expect(levelRule(level(value), atLeast(SeniorityLevelEnum.SENIOR))).toBeUndefined();
    }
  );

  it('keeps a position that names no level', () => {
    expect(levelRule(level(null), atLeast(SeniorityLevelEnum.SENIOR))).toBeUndefined();
  });

  it('keeps every level when the profile sets no lowest one', () => {
    expect(levelRule(level(SeniorityLevelEnum.INTERN), atLeast())).toBeUndefined();
  });
});
