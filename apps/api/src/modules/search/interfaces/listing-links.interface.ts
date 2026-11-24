import type { ListingGapEnum } from '../enums/listing-gap.enum.js';
import type { ILinkCandidate } from './link-candidate.interface.js';

/**
 * The links of a listing read page after page, and what kept part of it out of sight
 */
export interface IListingLinks {
  /**
   * Address of the first page, after redirects
   *
   * @var {string}
   */
  readonly url: string;

  /**
   * Pages read
   *
   * @var {number}
   */
  readonly pages: number;

  /**
   * Links of all the pages, one per URL, page order
   *
   * @var {readonly ILinkCandidate[]}
   */
  readonly candidates: readonly ILinkCandidate[];

  /**
   * Why the scan did not see the whole listing; empty when it did
   *
   * @var {readonly ListingGapEnum[]}
   */
  readonly gaps: readonly ListingGapEnum[];
}
