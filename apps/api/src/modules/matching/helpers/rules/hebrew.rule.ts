import { HebrewRequirementEnum, VacancyMatchVerdictEnum } from '@job-agent/shared';

import type { IVacancyData } from '../../../vacancies/interfaces/vacancy-data.interface.js';
import { MatchRuleEnum } from '../../enums/match-rule.enum.js';
import type { IMatchReason } from '../../interfaces/match-reason.interface.js';

/**
 * Hebrew required for speaking or writing does not fit; Hebrew as an advantage is a mark for the card
 *
 * @param {IVacancyData} vacancy
 *
 * @returns {IMatchReason | undefined}
 */
export function hebrewRule(vacancy: IVacancyData): IMatchReason | undefined {
  if (vacancy.hebrew === HebrewRequirementEnum.REQUIRED) {
    return { rule: MatchRuleEnum.HEBREW, effect: VacancyMatchVerdictEnum.NO_FIT, message: 'Hebrew is required' };
  }

  if (vacancy.hebrew === HebrewRequirementEnum.ADVANTAGE) {
    return { rule: MatchRuleEnum.HEBREW, effect: VacancyMatchVerdictEnum.FIT, message: 'Hebrew is an advantage' };
  }

  return undefined;
}
