import { VacancyMatchVerdictEnum } from '@job-agent/shared';

import type { IVacancyData, IVacancySkill } from '../../../vacancies/interfaces/vacancy-data.interface.js';
import { MatchRuleEnum } from '../../enums/match-rule.enum.js';
import type { IMatchReason } from '../../interfaces/match-reason.interface.js';
import type { IResumeFacts } from '../../interfaces/resume-facts.interface.js';

/**
 * Display names of skills
 *
 * @param {readonly IVacancySkill[]} skills
 *
 * @returns {string}
 */
function names(skills: readonly IVacancySkill[]): string {
  return skills.map(skill => skill.name).join(', ');
}

/**
 * The main rule: at least one programming language the vacancy requires is among the visible skills of the resume.
 * A vacancy that requires none is checked against its preferred languages; one that names no language at all is
 * `almost` — the human reads it. Matched languages are a mark for the card
 *
 * @param {IVacancyData} vacancy
 * @param {IResumeFacts} resume
 *
 * @returns {IMatchReason}
 */
export function languagesRule(vacancy: IVacancyData, resume: IResumeFacts): IMatchReason {
  const asked = vacancy.requiredLanguages.length > 0 ? vacancy.requiredLanguages : vacancy.preferredLanguages;

  if (asked.length === 0) {
    return { rule: MatchRuleEnum.LANGUAGES, effect: VacancyMatchVerdictEnum.ALMOST, message: 'the vacancy names no programming language' };
  }

  const matched = asked.filter(skill => resume.skillKeys.has(skill.key));

  if (matched.length === 0) {
    return {
      rule: MatchRuleEnum.LANGUAGES,
      effect: VacancyMatchVerdictEnum.NO_FIT,
      message: `asks for ${names(asked)} — none of them in the resume`,
      params: { asked: asked.map(skill => skill.key) }
    };
  }

  return {
    rule: MatchRuleEnum.LANGUAGES,
    effect: VacancyMatchVerdictEnum.FIT,
    message: `matches ${names(matched)}`,
    params: { matched: matched.map(skill => skill.name) }
  };
}
