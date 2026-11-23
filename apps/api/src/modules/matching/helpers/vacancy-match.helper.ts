import { VacancyMatchVerdictEnum } from '@job-agent/shared';

import type { IVacancyData } from '../../vacancies/interfaces/vacancy-data.interface.js';
import type { ProfilePreferencesType } from '../../vacancies/schemas/profile-preferences.schema.js';
import type { IMatchReason, IMatchResult } from '../interfaces/match-reason.interface.js';
import type { IPositionFacts } from '../interfaces/position-facts.interface.js';
import type { IResumeFacts } from '../interfaces/resume-facts.interface.js';
import { companyRule } from './rules/company.rule.js';
import { experienceRule } from './rules/experience.rule.js';
import { hebrewRule } from './rules/hebrew.rule.js';
import { languagesRule } from './rules/languages.rule.js';
import { levelRule } from './rules/level.rule.js';
import { placeRule } from './rules/place.rule.js';
import { roleRule } from './rules/role.rule.js';

/**
 * Verdicts from the best to the worst — the worst finding decides
 *
 * @type {readonly VacancyMatchVerdictEnum[]}
 */
const VERDICT_ORDER: readonly VacancyMatchVerdictEnum[] = [
  VacancyMatchVerdictEnum.FIT,
  VacancyMatchVerdictEnum.ALMOST,
  VacancyMatchVerdictEnum.NO_FIT
];

/**
 * The worst effect among the findings
 *
 * @param {readonly IMatchReason[]} reasons
 *
 * @returns {VacancyMatchVerdictEnum}
 */
function worstEffect(reasons: readonly IMatchReason[]): VacancyMatchVerdictEnum {
  return reasons.reduce<VacancyMatchVerdictEnum>(
    (worst, reason) => (VERDICT_ORDER.indexOf(reason.effect) > VERDICT_ORDER.indexOf(worst) ? reason.effect : worst),
    VacancyMatchVerdictEnum.FIT
  );
}

/**
 * Findings of the rules a listing line can be checked by: company, role, level, place — before any extraction
 *
 * @param {IPositionFacts} facts
 * @param {ProfilePreferencesType} preferences
 *
 * @returns {IMatchReason[]}
 */
export function screenPosition(facts: IPositionFacts, preferences: ProfilePreferencesType): IMatchReason[] {
  return [
    companyRule(facts, preferences),
    roleRule(facts, preferences),
    levelRule(facts, preferences),
    placeRule(facts, preferences)
  ].filter(reason => reason !== undefined);
}

/**
 * The verdict for an extracted vacancy against one resume version: the place, level and company rules of the
 * profile, then the languages, Hebrew and experience — the worst effect decides, every finding is kept. Frameworks
 * never change it
 *
 * @param {IVacancyData} vacancy
 * @param {string} company Company of the vacancy row — the key it was found by
 * @param {ProfilePreferencesType} preferences
 * @param {IResumeFacts} resume
 *
 * @returns {IMatchResult}
 */
export function matchVacancy(
  vacancy: IVacancyData,
  company: string,
  preferences: ProfilePreferencesType,
  resume: IResumeFacts
): IMatchResult {
  const facts: IPositionFacts = { ...vacancy, company, roleFamily: null };
  const reasons = [
    ...screenPosition(facts, preferences),
    languagesRule(vacancy, resume),
    hebrewRule(vacancy),
    experienceRule(vacancy, resume)
  ].filter(reason => reason !== undefined);

  return { verdict: worstEffect(reasons), reasons };
}
