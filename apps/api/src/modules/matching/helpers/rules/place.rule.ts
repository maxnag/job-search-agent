import { VacancyMatchVerdictEnum } from '@job-agent/shared';

import { normalizeCity } from '../../../vacancies/helpers/vacancy-key.helper.js';
import type { ProfilePreferencesType } from '../../../vacancies/schemas/profile-preferences.schema.js';
import { MatchRuleEnum } from '../../enums/match-rule.enum.js';
import type { IMatchReason } from '../../interfaces/match-reason.interface.js';
import type { IPositionFacts } from '../../interfaces/position-facts.interface.js';

/**
 * A finding of the place rule
 *
 * @param {string} message
 *
 * @returns {IMatchReason}
 */
function outside(message: string): IMatchReason {
  return { rule: MatchRuleEnum.PLACE, effect: VacancyMatchVerdictEnum.NO_FIT, message };
}

/**
 * A country the profile does not search in, a work mode it does not accept there, or a city it excludes there does
 * not fit; an unknown country, mode or city passes, and no places listed means anywhere
 *
 * @param {IPositionFacts} facts
 * @param {ProfilePreferencesType} preferences
 *
 * @returns {IMatchReason | undefined}
 */
export function placeRule(facts: IPositionFacts, preferences: ProfilePreferencesType): IMatchReason | undefined {
  if (!facts.country || preferences.places.length === 0) {
    return undefined;
  }

  const place = preferences.places.find(candidate => candidate.country === facts.country);

  if (!place) {
    return outside(`country ${facts.country} is not searched`);
  }

  if (facts.workMode && !place.work_modes.includes(facts.workMode)) {
    return outside(`work mode ${facts.workMode} is not accepted in ${place.country}`);
  }

  const city = facts.city ? normalizeCity(facts.city) : '';

  if (city !== '' && place.excluded_cities.some(excluded => normalizeCity(excluded) === city)) {
    return outside(`city ${facts.city} is excluded in ${place.country}`);
  }

  return undefined;
}
