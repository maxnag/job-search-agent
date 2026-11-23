import { SENIORITY_LEVELS, VacancyMatchVerdictEnum } from '@job-agent/shared';

import type { ProfilePreferencesType } from '../../../vacancies/schemas/profile-preferences.schema.js';
import { MatchRuleEnum } from '../../enums/match-rule.enum.js';
import type { IMatchReason } from '../../interfaces/match-reason.interface.js';
import type { IPositionFacts } from '../../interfaces/position-facts.interface.js';

/**
 * A level below the profile's minimum does not fit; an unknown level passes
 *
 * @param {IPositionFacts} facts
 * @param {ProfilePreferencesType} preferences
 *
 * @returns {IMatchReason | undefined}
 */
export function levelRule(facts: IPositionFacts, preferences: ProfilePreferencesType): IMatchReason | undefined {
  if (!facts.level || !preferences.min_level || SENIORITY_LEVELS.indexOf(facts.level) >= SENIORITY_LEVELS.indexOf(preferences.min_level)) {
    return undefined;
  }

  return {
    rule: MatchRuleEnum.LEVEL,
    effect: VacancyMatchVerdictEnum.NO_FIT,
    message: `level ${facts.level} is below ${preferences.min_level}`
  };
}
