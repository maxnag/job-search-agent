import type {
  SeniorityLevelEnum,
  SortOrderEnum,
  VacancyActionKindEnum,
  VacancyMatchVerdictEnum,
  VacancySortEnum,
  VacancyStageEnum,
  WorkModeEnum
} from '@job-agent/shared';

import type { IMatchReason } from '../../matching/interfaces/match-reason.interface.js';

/**
 * Which page of the positions a filter selects, and in which order
 */
export interface IVacancyReportPageRequest {
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
   * Column to sort by
   *
   * @var {VacancySortEnum}
   */
  readonly sort: VacancySortEnum;

  /**
   * Direction of the sort
   *
   * @var {SortOrderEnum}
   */
  readonly order: SortOrderEnum;
}

/**
 * One position of a page, with its source and the latest choice of the owner
 */
export interface IReportPageVacancy {
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
  readonly sourceName: string;

  /**
   * First seen
   *
   * @var {Date}
   */
  readonly firstSeenAt: Date;

  /**
   * The latest choice of the owner, if any
   *
   * @var {VacancyActionKindEnum | null}
   */
  readonly lastAction: VacancyActionKindEnum | null;
}

/**
 * The verdict of a position of a page against the current resume of one profile
 */
export interface IReportPageMatch {
  /**
   * Vacancy id
   *
   * @var {number}
   */
  readonly vacancyId: number;

  /**
   * Profile
   *
   * @var {string}
   */
  readonly profileName: string;

  /**
   * Verdict
   *
   * @var {VacancyMatchVerdictEnum}
   */
  readonly verdict: VacancyMatchVerdictEnum;

  /**
   * Findings of the rules
   *
   * @var {readonly IMatchReason[]}
   */
  readonly reasons: readonly IMatchReason[];
}

/**
 * One page of the positions a filter selects
 */
export interface IVacancyReportPage {
  /**
   * Positions the filter selects, on every page
   *
   * @var {number}
   */
  readonly total: number;

  /**
   * Positions of the page, in the order asked for
   *
   * @var {readonly IReportPageVacancy[]}
   */
  readonly vacancies: readonly IReportPageVacancy[];

  /**
   * Verdicts of the positions of the page, by profile name
   *
   * @var {readonly IReportPageMatch[]}
   */
  readonly matches: readonly IReportPageMatch[];
}
