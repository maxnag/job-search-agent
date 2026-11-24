import type { ATSKindEnum } from '@job-agent/shared';

/**
 * A company board on an applicant tracking system
 */
export interface IATSBoard {
  /**
   * The applicant tracking system
   *
   * @var {ATSKindEnum}
   */
  readonly kind: ATSKindEnum;

  /**
   * The board within it: the site name on Lever, the board token on Greenhouse, `<slug>/<company uid>` on Comeet
   *
   * @var {string}
   */
  readonly board: string;
}
