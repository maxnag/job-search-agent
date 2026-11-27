import type { VacancyActionKindEnum } from '@job-agent/shared';

/**
 * The latest choice about a vacancy that is not shown under its Telegram messages yet
 */
export interface IVacancyActionSync {
  /**
   * The vacancy
   *
   * @var {number}
   */
  readonly vacancyId: number;

  /**
   * Id of its latest choice — every choice up to it is synced together
   *
   * @var {number}
   */
  readonly vacancyActionId: number;

  /**
   * The latest choice
   *
   * @var {VacancyActionKindEnum}
   */
  readonly kind: VacancyActionKindEnum;
}
