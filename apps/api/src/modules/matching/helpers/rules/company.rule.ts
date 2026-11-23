import { VacancyMatchVerdictEnum } from '@job-agent/shared';

import { normalizeCompany } from '../../../vacancies/helpers/vacancy-key.helper.js';
import type { ProfilePreferencesType } from '../../../vacancies/schemas/profile-preferences.schema.js';
import { MatchRuleEnum } from '../../enums/match-rule.enum.js';
import type { IMatchReason } from '../../interfaces/match-reason.interface.js';
import type { IPositionFacts } from '../../interfaces/position-facts.interface.js';

/**
 * A company the profile excludes does not fit; names are compared without case, punctuation and legal suffixes
 *
 * @param {IPositionFacts} facts
 * @param {ProfilePreferencesType} preferences
 *
 * @returns {IMatchReason | undefined}
 */
export function companyRule(facts: IPositionFacts, preferences: ProfilePreferencesType): IMatchReason | undefined {
  const company = normalizeCompany(facts.company);

  if (!preferences.excluded_companies.some(excluded => normalizeCompany(excluded) === company)) {
    return undefined;
  }

  return { rule: MatchRuleEnum.COMPANY, effect: VacancyMatchVerdictEnum.NO_FIT, message: `company ${facts.company} is excluded` };
}
