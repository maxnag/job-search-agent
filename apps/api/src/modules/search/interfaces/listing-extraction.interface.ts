import type { ListingGapEnum } from '../enums/listing-gap.enum.js';
import type { IListedPosition } from './listed-position.interface.js';

/**
 * Positions of a listing and the number of pages and links they were picked from
 */
export interface IListingExtraction {
  /**
   * Pages of the listing read — a board answers in one
   *
   * @var {number}
   */
  readonly pages: number;

  /**
   * Links the pages offered — few of them in the `html` mode hint at a list drawn by JavaScript
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

  /**
   * Why the scan did not see the whole listing; empty when it did
   *
   * @var {readonly ListingGapEnum[]}
   */
  readonly gaps: readonly ListingGapEnum[];
}
