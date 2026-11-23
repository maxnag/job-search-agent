import type { VacancyExtractionOutcomeEnum } from '../enums/vacancy-extraction-outcome.enum.js';

/**
 * What one extraction did — the result of its job
 */
export interface IVacancyExtractionSummary {
  /**
   * The vacancy
   *
   * @var {number}
   */
  readonly vacancyId: number;

  /**
   * How the extraction ended
   *
   * @var {VacancyExtractionOutcomeEnum}
   */
  readonly outcome: VacancyExtractionOutcomeEnum;
}
