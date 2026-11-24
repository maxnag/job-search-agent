import type { ILinkCandidate } from './link-candidate.interface.js';

/**
 * The links of a listing page and whether the link limit cut them short
 */
export interface ILinkCandidates {
  /**
   * Links, one per URL, page order
   *
   * @var {ILinkCandidate[]}
   */
  readonly candidates: ILinkCandidate[];

  /**
   * True when the page has links past the limit
   *
   * @var {boolean}
   */
  readonly truncated: boolean;
}
