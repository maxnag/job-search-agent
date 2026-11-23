import { VacancyMatchVerdictEnum } from '@job-agent/shared';

import type { ProfilePreferencesType } from '../../../vacancies/schemas/profile-preferences.schema.js';
import { MatchRuleEnum } from '../../enums/match-rule.enum.js';
import type { IMatchReason } from '../../interfaces/match-reason.interface.js';
import type { IPositionFacts } from '../../interfaces/position-facts.interface.js';

/**
 * A role family the profile does not search for does not fit; no families listed — every family is searched
 *
 * @param {IPositionFacts} facts
 * @param {ProfilePreferencesType} preferences
 *
 * @returns {IMatchReason | undefined}
 */
export function roleRule(facts: IPositionFacts, preferences: ProfilePreferencesType): IMatchReason | undefined {
  if (!facts.roleFamily || preferences.role_families.length === 0 || preferences.role_families.includes(facts.roleFamily)) {
    return undefined;
  }

  return { rule: MatchRuleEnum.ROLE, effect: VacancyMatchVerdictEnum.NO_FIT, message: `role ${facts.roleFamily} is not searched` };
}
