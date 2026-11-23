/**
 * A link of a listing page with the text around it — what the LLM classifies
 */
export interface ILinkCandidate {
  /**
   * Absolute URL without the fragment
   *
   * @var {string}
   */
  readonly url: string;

  /**
   * Text of the link
   *
   * @var {string}
   */
  readonly text: string;

  /**
   * Text of the closest block around the link (location, team, work mode); empty when there is none
   *
   * @var {string}
   */
  readonly context: string;
}
