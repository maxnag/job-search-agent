/**
 * How the links of one site in a job mail are read: which hosts it covers, whether the crawler may open its vacancy
 * pages, and the canonical address of a link
 */
export interface IJobMailLinkRule {
  /**
   * Name of the rule, for the logs
   *
   * @var {string}
   */
  readonly name: string;

  /**
   * True when the crawler never opens a vacancy page of the site (ADR-003) — the vacancy is read elsewhere
   *
   * @var {boolean}
   */
  readonly noFetch: boolean;

  /**
   * True when the rule covers the host
   *
   * @param {string} host Lower case, without a port
   *
   * @returns {boolean}
   */
  matches(host: string): boolean;

  /**
   * The canonical address of a link, without tracking; undefined for a link that is not a vacancy of the site —
   * unsubscribe, settings, a profile
   *
   * @param {URL} url
   * @param {string} text Text of the link
   *
   * @returns {string | undefined}
   */
  canonicalURL(url: URL, text: string): string | undefined;
}
