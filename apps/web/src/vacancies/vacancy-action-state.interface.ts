import type { VacancyActionKindEnum } from '@job-agent/shared';

/**
 * What the buttons of a vacancy show after a press
 */
export interface IVacancyActionState {
  /**
   * The latest choice about the vacancy, as the API stored it
   *
   * @var {VacancyActionKindEnum | null}
   */
  readonly kind: VacancyActionKindEnum | null;

  /**
   * True when the last press was not saved
   *
   * @var {boolean}
   */
  readonly failed: boolean;
}
