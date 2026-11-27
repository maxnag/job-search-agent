import type { SeniorityLevelEnum } from './seniority-level.enum.js';
import type { VacancyActionKindEnum } from './vacancy-action-kind.enum.js';
import type { VacancyMatchVerdictEnum } from './vacancy-match-verdict.enum.js';
import type { VacancyStageEnum } from './vacancy-stage.enum.js';
import type { WorkModeEnum } from './work-mode.enum.js';

/**
 * The verdict of a vacancy against the current resume of one profile, as the list shows it
 */
export interface IVacancyListVerdict {
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
   * What lowered the verdict, as the rules wrote it; empty for a clean fit
   *
   * @var {readonly string[]}
   */
  readonly findings: readonly string[];
}

/**
 * One row of the list of vacancies
 */
export interface IVacancyListItem {
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
   * Name of its source
   *
   * @var {string}
   */
  readonly source: string;

  /**
   * First seen, ISO 8601
   *
   * @var {string}
   */
  readonly firstSeenAt: string;

  /**
   * The latest choice of the owner, if any
   *
   * @var {VacancyActionKindEnum | null}
   */
  readonly lastAction: VacancyActionKindEnum | null;

  /**
   * Verdicts per profile
   *
   * @var {readonly IVacancyListVerdict[]}
   */
  readonly verdicts: readonly IVacancyListVerdict[];
}

/**
 * One page of the list of vacancies a filter selects
 */
export interface IVacancyListPage {
  /**
   * Vacancies the filter selects, on every page
   *
   * @var {number}
   */
  readonly total: number;

  /**
   * Page number, from 1
   *
   * @var {number}
   */
  readonly page: number;

  /**
   * Rows on a page
   *
   * @var {number}
   */
  readonly pageSize: number;

  /**
   * Rows of the page
   *
   * @var {readonly IVacancyListItem[]}
   */
  readonly vacancies: readonly IVacancyListItem[];
}
