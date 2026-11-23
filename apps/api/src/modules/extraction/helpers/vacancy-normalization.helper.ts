import { SkillKindEnum, normalizeSkill } from '@job-agent/shared';

import { VACANCY_FIELD_LIMITS, clipNullable, clipText } from '../../vacancies/helpers/vacancy-fields.helper.js';
import type { IVacancyData, IVacancySkill } from '../../vacancies/interfaces/vacancy-data.interface.js';
import type { VacancyExtractionType } from '../schemas/vacancy-extraction.schema.js';

/**
 * A skill as the LLM named it and grouped it
 */
interface INamedSkill {
  /**
   * Name as written
   *
   * @var {string}
   */
  readonly name: string;

  /**
   * Named among the programming languages
   *
   * @var {boolean}
   */
  readonly asLanguage: boolean;

  /**
   * A requirement, not an advantage
   *
   * @var {boolean}
   */
  readonly required: boolean;
}

/**
 * The three lists a skill of a vacancy can land in
 */
interface ISkillLists {
  /**
   * Required programming languages
   *
   * @var {Map<string, IVacancySkill>}
   */
  readonly required: Map<string, IVacancySkill>;

  /**
   * Preferred programming languages
   *
   * @var {Map<string, IVacancySkill>}
   */
  readonly preferred: Map<string, IVacancySkill>;

  /**
   * Everything else
   *
   * @var {Map<string, IVacancySkill>}
   */
  readonly frameworks: Map<string, IVacancySkill>;
}

/**
 * The list a named skill belongs to: the dictionary's kind decides whether it is a language, the LLM's grouping only
 * for an unknown skill
 *
 * @param {SkillKindEnum | undefined} kind
 * @param {INamedSkill} skill
 * @param {ISkillLists} lists
 *
 * @returns {Map<string, IVacancySkill>}
 */
function targetOf(kind: SkillKindEnum | undefined, skill: INamedSkill, lists: ISkillLists): Map<string, IVacancySkill> {
  const isLanguage = kind ? kind === SkillKindEnum.PROGRAMMING_LANGUAGE : skill.asLanguage;

  if (!isLanguage) {
    return lists.frameworks;
  }

  return skill.required || !skill.asLanguage ? lists.required : lists.preferred;
}

/**
 * The extraction of a vacancy mapped onto the skill dictionary. The dictionary, not the LLM, decides what a
 * programming language is: a known framework named as a language moves to the frameworks, a known language named among
 * the frameworks moves to the required languages — the posting gave no «nice to have» for it. Text fields and skill
 * lists are clipped to `VACANCY_FIELD_LIMITS`, a skill name longer than its limit is dropped. A language both
 * required and preferred counts as required
 *
 * @param {VacancyExtractionType} extraction
 * @param {string} model
 *
 * @returns {IVacancyData}
 */
export function normalizeVacancyExtraction(extraction: VacancyExtractionType, model: string): IVacancyData {
  const required = new Map<string, IVacancySkill>();
  const preferred = new Map<string, IVacancySkill>();
  const frameworks = new Map<string, IVacancySkill>();
  const named: INamedSkill[] = [
    ...extraction.programming_languages.map(language => ({ name: language.name, asLanguage: true, required: language.required })),
    ...extraction.frameworks.map(name => ({ name, asLanguage: false, required: false }))
  ].filter(skill => skill.name.length <= VACANCY_FIELD_LIMITS.skillName);

  for (const skill of named) {
    const normalized = normalizeSkill(skill.name);

    if (!normalized.key) {
      continue;
    }

    const entry = { key: normalized.key, name: normalized.name, isUnknown: normalized.isUnknown };
    const target = targetOf(normalized.kind, skill, { required, preferred, frameworks });

    if (!target.has(entry.key)) {
      target.set(entry.key, entry);
    }
  }

  for (const key of required.keys()) {
    preferred.delete(key);
  }

  return {
    title: clipText(extraction.title, VACANCY_FIELD_LIMITS.title),
    company: clipNullable(extraction.company, VACANCY_FIELD_LIMITS.company),
    level: extraction.level,
    country: extraction.country?.toUpperCase() ?? null,
    city: clipNullable(extraction.city, VACANCY_FIELD_LIMITS.city),
    workMode: extraction.work_mode,
    requiredLanguages: [...required.values()].slice(0, VACANCY_FIELD_LIMITS.skills),
    preferredLanguages: [...preferred.values()].slice(0, VACANCY_FIELD_LIMITS.skills),
    frameworks: [...frameworks.values()].slice(0, VACANCY_FIELD_LIMITS.skills),
    yearsRequired: extraction.years_required,
    hebrew: extraction.hebrew,
    summary: clipText(extraction.summary, VACANCY_FIELD_LIMITS.summary),
    model
  };
}
