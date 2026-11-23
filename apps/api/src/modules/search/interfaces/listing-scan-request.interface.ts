import type { VacancyRowType } from '../../vacancies/interfaces/vacancy-row.interface.js';
import type { IScreenedPosition } from './screened-position.interface.js';

/**
 * What a scan plan is made from
 */
export interface IListingScanRequest {
  /**
   * Source scanned
   *
   * @var {number}
   */
  readonly sourceId: number;

  /**
   * Positions of its page, screened
   *
   * @var {readonly IScreenedPosition[]}
   */
  readonly positions: readonly IScreenedPosition[];

  /**
   * Vacancies of any source with the URL or the dedup key of a position
   *
   * @var {readonly VacancyRowType[]}
   */
  readonly known: readonly VacancyRowType[];

  /**
   * Vacancies of the source that are not closed
   *
   * @var {readonly VacancyRowType[]}
   */
  readonly open: readonly VacancyRowType[];

  /**
   * Time of the scan
   *
   * @var {Date}
   */
  readonly now: Date;

  /**
   * An extracted vacancy whose page was last read before this time is read again
   *
   * @var {Date}
   */
  readonly recheckBefore: Date;
}
