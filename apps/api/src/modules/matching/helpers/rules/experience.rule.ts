import { VacancyMatchVerdictEnum } from '@job-agent/shared';

import type { IVacancyData } from '../../../vacancies/interfaces/vacancy-data.interface.js';
import { MatchRuleEnum } from '../../enums/match-rule.enum.js';
import type { IMatchReason } from '../../interfaces/match-reason.interface.js';
import type { IResumeFacts } from '../../interfaces/resume-facts.interface.js';

/**
 * More years required than the resume has is `almost`, with the required years as the mark; the owner's own years
 * are never put in the reason. Unknown on either side — nothing to say
 *
 * @param {IVacancyData} vacancy
 * @param {IResumeFacts} resume
 *
 * @returns {IMatchReason | undefined}
 */
export function experienceRule(vacancy: IVacancyData, resume: IResumeFacts): IMatchReason | undefined {
  if (vacancy.yearsRequired === null || resume.experienceYears === null || vacancy.yearsRequired <= resume.experienceYears) {
    return undefined;
  }

  return {
    rule: MatchRuleEnum.EXPERIENCE,
    effect: VacancyMatchVerdictEnum.ALMOST,
    message: `requires ${vacancy.yearsRequired}+ years`,
    params: { required: vacancy.yearsRequired }
  };
}
