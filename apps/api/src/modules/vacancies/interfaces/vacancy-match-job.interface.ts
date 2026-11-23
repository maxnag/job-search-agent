/**
 * Data of a `vacancy-matched` job: a new `fit` or `almost` verdict whose card is to be sent
 */
export interface IVacancyMatchJob {
  /**
   * The verdict row
   *
   * @var {number}
   */
  readonly vacancyMatchId: number;
}
