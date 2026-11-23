/**
 * A page as a fetcher got it — the status is reported, never thrown, so the crawler decides what it means
 */
export interface IFetchedPage {
  /**
   * Final URL, after redirects
   *
   * @var {string}
   */
  readonly url: string;

  /**
   * HTTP status of the document; 0 when the browser got no response
   *
   * @var {number}
   */
  readonly status: number;

  /**
   * Response headers, lower-cased names
   *
   * @var {Readonly<Record<string, string>>}
   */
  readonly headers: Readonly<Record<string, string>>;

  /**
   * HTML of the page — after rendering for the `rendered` mode
   *
   * @var {string}
   */
  readonly html: string;
}
