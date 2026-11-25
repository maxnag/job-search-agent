import type { VacancyActionKindEnum, VacancyStageEnum } from '@job-agent/shared';

/**
 * Which choices of the owner to list
 */
export interface IJobsDBApplicationFilter {
  /**
   * The choice
   *
   * @var {VacancyActionKindEnum}
   */
  readonly kind: VacancyActionKindEnum;

  /**
   * Made within this many days
   *
   * @var {number}
   */
  readonly sinceDays?: number;
}

/**
 * A vacancy with the latest choice of one kind the owner made about it
 */
export interface IJobsDBApplication {
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
   * Stage now
   *
   * @var {VacancyStageEnum}
   */
  readonly stage: VacancyStageEnum;

  /**
   * Closed, if it is
   *
   * @var {Date | null}
   */
  readonly closedAt: Date | null;

  /**
   * Page of the position
   *
   * @var {string}
   */
  readonly url: string;

  /**
   * When the choice was made
   *
   * @var {Date}
   */
  readonly at: Date;
}
