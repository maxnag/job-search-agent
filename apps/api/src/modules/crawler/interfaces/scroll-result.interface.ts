/**
 * How the scrolling of a rendered page ended
 */
export interface IScrollResult {
  /**
   * Scrolls made
   *
   * @var {number}
   */
  readonly scrolls: number;

  /**
   * True when it stopped before the links stopped growing: the scroll limit, the deadline, or a wait the deadline cut
   * short
   *
   * @var {boolean}
   */
  readonly partial: boolean;
}
