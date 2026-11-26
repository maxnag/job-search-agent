import type {
  RoleFamilyEnum,
  SeniorityLevelEnum,
  VacancyActionKindEnum,
  VacancyMatchVerdictEnum,
  VacancyStageEnum,
  WorkModeEnum
} from '@job-agent/shared';

import type { IMatchReason } from '../../matching/interfaces/match-reason.interface.js';

/**
 * One vacancy with everything the extraction found in it
 */
export interface IJobsDBVacancy {
  /**
   * Vacancy id
   *
   * @var {number}
   */
  readonly vacancyId: number;

  /**
   * Name of its source
   *
   * @var {string}
   */
  readonly sourceName: string;

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
   * Role family
   *
   * @var {RoleFamilyEnum | null}
   */
  readonly roleFamily: RoleFamilyEnum | null;

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
   * Why the filter dropped it
   *
   * @var {string | null}
   */
  readonly skipReason: string | null;

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
   * Fields the extraction found on its page
   *
   * @var {Record<string, unknown> | null}
   */
  readonly data: Record<string, unknown> | null;

  /**
   * First seen
   *
   * @var {Date}
   */
  readonly firstSeenAt: Date;

  /**
   * Last seen on its listing
   *
   * @var {Date}
   */
  readonly lastSeenAt: Date;

  /**
   * Closed, if it is
   *
   * @var {Date | null}
   */
  readonly closedAt: Date | null;
}

/**
 * The verdict for a vacancy against the current resume of one profile
 */
export interface IJobsDBVacancyMatch {
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

  /**
   * When its card was sent, if it was
   *
   * @var {Date | null}
   */
  readonly notifiedAt: Date | null;
}

/**
 * A choice the owner made about a vacancy
 */
export interface IJobsDBVacancyAction {
  /**
   * Choice
   *
   * @var {VacancyActionKindEnum}
   */
  readonly kind: VacancyActionKindEnum;

  /**
   * When
   *
   * @var {Date}
   */
  readonly at: Date;
}
