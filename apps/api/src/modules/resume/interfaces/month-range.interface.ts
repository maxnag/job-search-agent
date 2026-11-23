/**
 * A period in months since year 0: `start` inclusive, `end` exclusive
 */
export interface IMonthRange {
  /**
   * First month of the period
   *
   * @var {number}
   */
  readonly start: number;

  /**
   * Month after the last one
   *
   * @var {number}
   */
  readonly end: number;
}
