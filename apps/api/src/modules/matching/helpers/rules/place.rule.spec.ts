import { describe, expect, it } from 'vitest';

import { VacancyMatchVerdictEnum, WorkModeEnum } from '@job-agent/shared';

import type { ProfilePreferencesType } from '../../../vacancies/schemas/profile-preferences.schema.js';
import { MatchRuleEnum } from '../../enums/match-rule.enum.js';
import type { IPositionFacts } from '../../interfaces/position-facts.interface.js';
import { placeRule } from './place.rule.js';

const PREFERENCES: ProfilePreferencesType = {
  role_families: [],
  places: [
    { country: 'IL', work_modes: [WorkModeEnum.ONSITE, WorkModeEnum.HYBRID, WorkModeEnum.REMOTE], excluded_cities: ["Be'er Sheva"] },
    { country: 'UA', work_modes: [WorkModeEnum.REMOTE], excluded_cities: [] }
  ],
  excluded_companies: []
};

/**
 * Facts of a position in the given place
 *
 * @param {string | null} country
 * @param {WorkModeEnum | null} workMode
 * @param {string | null} city
 *
 * @returns {IPositionFacts}
 */
function at(country: string | null, workMode: WorkModeEnum | null = null, city: string | null = null): IPositionFacts {
  return { company: 'Northwind', roleFamily: null, level: null, country, city, workMode };
}

describe('placeRule', () => {
  it('drops a country the profile does not search', () => {
    expect(placeRule(at('US', WorkModeEnum.REMOTE), PREFERENCES)).toEqual({
      rule: MatchRuleEnum.PLACE,
      effect: VacancyMatchVerdictEnum.NO_FIT,
      message: 'country US is not searched'
    });
  });

  it('drops a work mode the country does not accept', () => {
    expect(placeRule(at('UA', WorkModeEnum.HYBRID, 'Kyiv'), PREFERENCES)).toEqual({
      rule: MatchRuleEnum.PLACE,
      effect: VacancyMatchVerdictEnum.NO_FIT,
      message: 'work mode hybrid is not accepted in UA'
    });
  });

  it('drops an excluded city, however it is spelled', () => {
    expect(placeRule(at('IL', WorkModeEnum.ONSITE, 'Beer-Sheva'), PREFERENCES)).toEqual({
      rule: MatchRuleEnum.PLACE,
      effect: VacancyMatchVerdictEnum.NO_FIT,
      message: 'city Beer-Sheva is excluded in IL'
    });
  });

  it('keeps an accepted country, work mode and city', () => {
    expect(placeRule(at('IL', WorkModeEnum.HYBRID, 'Haifa'), PREFERENCES)).toBeUndefined();
    expect(placeRule(at('UA', WorkModeEnum.REMOTE, 'Lviv'), PREFERENCES)).toBeUndefined();
  });

  it('keeps a searched country when the work mode or the city is unknown', () => {
    expect(placeRule(at('UA'), PREFERENCES)).toBeUndefined();
    expect(placeRule(at('IL', WorkModeEnum.ONSITE, ''), PREFERENCES)).toBeUndefined();
  });

  it('keeps a position without a country — "Remote" or "Worldwide"', () => {
    expect(placeRule(at(null, WorkModeEnum.REMOTE), PREFERENCES)).toBeUndefined();
  });

  it('keeps every place when the profile names none', () => {
    expect(placeRule(at('US', WorkModeEnum.ONSITE), { ...PREFERENCES, places: [] })).toBeUndefined();
  });

  it('does not exclude a city of the same name in another country', () => {
    const preferences: ProfilePreferencesType = {
      ...PREFERENCES,
      places: [...PREFERENCES.places, { country: 'US', work_modes: [WorkModeEnum.REMOTE], excluded_cities: [] }]
    };

    expect(placeRule(at('US', WorkModeEnum.REMOTE, "Be'er Sheva"), preferences)).toBeUndefined();
  });
});
