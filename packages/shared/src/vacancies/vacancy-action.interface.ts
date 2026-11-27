import type { VacancyActionKindEnum } from './vacancy-action-kind.enum.js';

/**
 * A choice of the owner sent to the API
 */
export interface IVacancyActionRequest {
  /**
   * Choice
   *
   * @var {VacancyActionKindEnum}
   */
  readonly kind: VacancyActionKindEnum;
}

/**
 * What the API did with a choice
 */
export interface IVacancyActionAnswer {
  /**
   * Choice
   *
   * @var {VacancyActionKindEnum}
   */
  readonly kind: VacancyActionKindEnum;

  /**
   * false when the latest choice was already this one — nothing new is stored
   *
   * @var {boolean}
   */
  readonly recorded: boolean;
}
