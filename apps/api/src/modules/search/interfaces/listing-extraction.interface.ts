import type { IListedPosition } from './listed-position.interface.js';

/**
 * Positions of a listing page and the number of links they were picked from
 */
export interface IListingExtraction {
  /**
   * Links the page offered — few of them in the `html` mode hint at a list drawn by JavaScript
   *
   * @var {number}
   */
  readonly links: number;

  /**
   * Positions, one per URL
   *
   * @var {readonly IListedPosition[]}
   */
  readonly positions: readonly IListedPosition[];
}
