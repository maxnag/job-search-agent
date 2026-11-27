import type { HebrewRequirementEnum } from './hebrew-requirement.enum.js';
import type { SeniorityLevelEnum } from './seniority-level.enum.js';
import type { VacancyActionKindEnum } from './vacancy-action-kind.enum.js';
import type { VacancyMatchVerdictEnum } from './vacancy-match-verdict.enum.js';
import type { VacancyStageEnum } from './vacancy-stage.enum.js';
import type { WorkModeEnum } from './work-mode.enum.js';

/**
 * A programming language the vacancy names
 */
export interface IVacancyCardLanguage {
  /**
   * Language
   *
   * @var {string}
   */
  readonly name: string;

  /**
   * Required, not only an advantage
   *
   * @var {boolean}
   */
  readonly required: boolean;
}

/**
 * What the extraction found on the page of the vacancy
 */
export interface IVacancyCardExtraction {
  /**
   * Summary, in the language of the page
   *
   * @var {string}
   */
  readonly summary: string;

  /**
   * Programming languages
   *
   * @var {readonly IVacancyCardLanguage[]}
   */
  readonly programmingLanguages: readonly IVacancyCardLanguage[];

  /**
   * Frameworks and tools
   *
   * @var {readonly string[]}
   */
  readonly frameworks: readonly string[];

  /**
   * Years of experience required
   *
   * @var {number | null}
   */
  readonly yearsRequired: number | null;

  /**
   * What it asks of Hebrew
   *
   * @var {HebrewRequirementEnum}
   */
  readonly hebrew: HebrewRequirementEnum;
}

/**
 * A finding of a matching rule
 */
export interface IVacancyCardFinding {
  /**
   * Rule
   *
   * @var {string}
   */
  readonly rule: string;

  /**
   * The verdict the finding allows
   *
   * @var {VacancyMatchVerdictEnum}
   */
  readonly effect: VacancyMatchVerdictEnum;

  /**
   * What the rule found
   *
   * @var {string}
   */
  readonly message: string;
}

/**
 * The verdict of a vacancy against the current resume of one profile
 */
export interface IVacancyCardMatch {
  /**
   * Profile
   *
   * @var {string}
   */
  readonly profile: string;

  /**
   * Verdict
   *
   * @var {VacancyMatchVerdictEnum}
   */
  readonly verdict: VacancyMatchVerdictEnum;

  /**
   * Findings of the rules
   *
   * @var {readonly IVacancyCardFinding[]}
   */
  readonly findings: readonly IVacancyCardFinding[];

  /**
   * When its card was sent, ISO 8601
   *
   * @var {string | null}
   */
  readonly notifiedAt: string | null;
}

/**
 * A choice the owner made about the vacancy
 */
export interface IVacancyCardAction {
  /**
   * Choice
   *
   * @var {VacancyActionKindEnum}
   */
  readonly kind: VacancyActionKindEnum;

  /**
   * When, ISO 8601
   *
   * @var {string}
   */
  readonly at: string;
}

/**
 * A vacancy with everything known about it
 */
export interface IVacancyCard {
  /**
   * Vacancy id
   *
   * @var {number}
   */
  readonly vacancyId: number;

  /**
   * Title
   *
   * @var {string}
   */
  readonly title: string;

  /**
   * Company
   *
   * @var {string}
   */
  readonly company: string;

  /**
   * City
   *
   * @var {string | null}
   */
  readonly city: string | null;

  /**
   * Country code
   *
   * @var {string | null}
   */
  readonly country: string | null;

  /**
   * Work mode
   *
   * @var {WorkModeEnum | null}
   */
  readonly workMode: WorkModeEnum | null;

  /**
   * Seniority level
   *
   * @var {SeniorityLevelEnum | null}
   */
  readonly level: SeniorityLevelEnum | null;

  /**
   * Stage
   *
   * @var {VacancyStageEnum}
   */
  readonly stage: VacancyStageEnum;

  /**
   * Why the code filter dropped it
   *
   * @var {string | null}
   */
  readonly skipReason: string | null;

  /**
   * Name of its source
   *
   * @var {string}
   */
  readonly source: string;

  /**
   * Page of the position
   *
   * @var {string}
   */
  readonly url: string;

  /**
   * The same position on the board of the company, when its own page is never opened
   *
   * @var {string | null}
   */
  readonly textURL: string | null;

  /**
   * First seen, ISO 8601
   *
   * @var {string}
   */
  readonly firstSeenAt: string;

  /**
   * Last seen on its listing, ISO 8601
   *
   * @var {string}
   */
  readonly lastSeenAt: string;

  /**
   * Closed, ISO 8601
   *
   * @var {string | null}
   */
  readonly closedAt: string | null;

  /**
   * What the extraction found, once it ran
   *
   * @var {IVacancyCardExtraction | null}
   */
  readonly extraction: IVacancyCardExtraction | null;

  /**
   * Verdicts per profile
   *
   * @var {readonly IVacancyCardMatch[]}
   */
  readonly matches: readonly IVacancyCardMatch[];

  /**
   * Choices of the owner, oldest first
   *
   * @var {readonly IVacancyCardAction[]}
   */
  readonly actions: readonly IVacancyCardAction[];
}
