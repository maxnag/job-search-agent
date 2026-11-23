import type { IListedPosition } from './listed-position.interface.js';

/**
 * A listed position after the code filter: no reason — it goes to extraction
 */
export interface IScreenedPosition extends IListedPosition {
  /**
   * Why no profile searches for it
   *
   * @var {string | undefined}
   */
  readonly skipReason?: string;
}
