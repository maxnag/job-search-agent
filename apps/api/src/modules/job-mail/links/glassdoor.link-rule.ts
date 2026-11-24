import type { IJobMailLinkRule } from '../interfaces/job-mail-link-rule.interface.js';

/**
 * Host of Glassdoor in any country: glassdoor.com, glassdoor.co.uk, www.glassdoor.co.il …
 *
 * @type {RegExp}
 */
const GLASSDOOR_HOST = /(^|\.)glassdoor\.[a-z.]+$/;

/**
 * Query parameters a Glassdoor link keeps the job listing id in
 *
 * @type {readonly string[]}
 */
const LISTING_PARAMS: readonly string[] = ['jl', 'jobListingId'];

/**
 * Glassdoor: only the links to a job listing are kept, as `https://www.glassdoor.com/job-listing/index.htm?jl=<id>`;
 * the crawler never opens them (ADR-003) — the owner does, from the card
 *
 * @type {IJobMailLinkRule}
 */
export const GLASSDOOR_LINK_RULE: IJobMailLinkRule = {
  name: 'glassdoor',
  noFetch: true,

  /**
   * Covers Glassdoor of every country
   *
   * @param {string} host
   *
   * @returns {boolean}
   */
  matches(host: string): boolean {
    return GLASSDOOR_HOST.test(host);
  },

  /**
   * The canonical link of a job listing; undefined for any other link of the site
   *
   * @param {URL} url
   *
   * @returns {string | undefined}
   */
  canonicalURL(url: URL): string | undefined {
    const listingId = LISTING_PARAMS.map(name => url.searchParams.get(name)).find(value => value && /^\d+$/.test(value));

    return listingId ? `https://www.glassdoor.com/job-listing/index.htm?jl=${listingId}` : undefined;
  }
};
