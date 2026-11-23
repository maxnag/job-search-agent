import type { HebrewRequirementEnum, SeniorityLevelEnum, WorkModeEnum } from '@job-agent/shared';

/**
 * A skill a vacancy names, mapped onto the skill dictionary
 */
export interface IVacancySkill {
  /**
   * Canonical key, or a slug when the dictionary does not know it
   *
   * @var {string}
   */
  readonly key: string;

  /**
   * Display name
   *
   * @var {string}
   */
  readonly name: string;

  /**
   * True when the dictionary does not know the skill
   *
   * @var {boolean}
   */
  readonly isUnknown: boolean;
}

/**
 * `vacancies.vacancy_data`: what the vacancy page says, normalized — the matching code reads it
 */
export interface IVacancyData {
  /**
   * Title on the vacancy page
   *
   * @var {string}
   */
  readonly title: string;

  /**
   * Hiring company named on the page
   *
   * @var {string | null}
   */
  readonly company: string | null;

  /**
   * Level from the title and the text
   *
   * @var {SeniorityLevelEnum | null}
   */
  readonly level: SeniorityLevelEnum | null;

  /**
   * ISO 3166-1 alpha-2 country code
   *
   * @var {string | null}
   */
  readonly country: string | null;

  /**
   * City in English
   *
   * @var {string | null}
   */
  readonly city: string | null;

  /**
   * Work mode
   *
   * @var {WorkModeEnum | null}
   */
  readonly workMode: WorkModeEnum | null;

  /**
   * Programming languages the vacancy requires
   *
   * @var {readonly IVacancySkill[]}
   */
  readonly requiredLanguages: readonly IVacancySkill[];

  /**
   * Programming languages it names as an advantage
   *
   * @var {readonly IVacancySkill[]}
   */
  readonly preferredLanguages: readonly IVacancySkill[];

  /**
   * Frameworks, libraries and tools it names — they do not change the verdict
   *
   * @var {readonly IVacancySkill[]}
   */
  readonly frameworks: readonly IVacancySkill[];

  /**
   * Years of experience it requires
   *
   * @var {number | null}
   */
  readonly yearsRequired: number | null;

  /**
   * What it says about Hebrew
   *
   * @var {HebrewRequirementEnum}
   */
  readonly hebrew: HebrewRequirementEnum;

  /**
   * A few sentences on what the job is
   *
   * @var {string}
   */
  readonly summary: string;

  /**
   * Model that extracted it
   *
   * @var {string}
   */
  readonly model: string;
}
