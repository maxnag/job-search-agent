import type { IATSBoard } from '../../ats/interfaces/a-t-s-board.interface.js';
import type { SourceRowType } from './source-row.interface.js';

/**
 * A career page the owner adds as a source
 */
export interface ISourceRegistrationRequest {
  /**
   * Any link to the page — for an applicant tracking system, a link to the board or to one of its positions
   *
   * @var {string}
   */
  readonly url: string;

  /**
   * Company name; when absent, the board's company name, else the board name or the host of the page
   *
   * @var {string | undefined}
   */
  readonly name?: string;
}

/**
 * What adding a source did
 */
export interface ISourceRegistrationResult {
  /**
   * The source — the new one, or the one that already had the URL
   *
   * @var {SourceRowType}
   */
  readonly source: SourceRowType;

  /**
   * False when the source already existed
   *
   * @var {boolean}
   */
  readonly created: boolean;

  /**
   * The board, for a source on an applicant tracking system
   *
   * @var {IATSBoard | undefined}
   */
  readonly board?: IATSBoard;

  /**
   * Published positions of the board, when it was read
   *
   * @var {number | undefined}
   */
  readonly positions?: number;

  /**
   * Positions some profile wants by company and place, when the board was read
   *
   * @var {number | undefined}
   */
  readonly passing?: number;

  /**
   * Positions whose country the board gives as a field, when the board was read — without it the place is read at
   * the scan
   *
   * @var {number | undefined}
   */
  readonly located?: number;
}
