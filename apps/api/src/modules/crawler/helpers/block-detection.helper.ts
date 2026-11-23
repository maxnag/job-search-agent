import type { IFetchedPage } from '../interfaces/fetched-page.interface.js';

/**
 * HTTP statuses a site answers a crawler it does not want
 *
 * @type {ReadonlySet<number>}
 */
const REFUSAL_STATUSES: ReadonlySet<number> = new Set([403, 429]);

/**
 * Markers that appear only on a challenge or captcha page, never on a regular one. A plain reCAPTCHA is not one:
 * a career page may carry it in its application form
 *
 * @type {ReadonlyArray<readonly [string, string]>}
 */
const CHALLENGE_MARKERS: ReadonlyArray<readonly [string, string]> = [
  ['_cf_chl_opt', 'Cloudflare challenge'],
  ['captcha-delivery.com', 'DataDome captcha'],
  ['px-captcha', 'PerimeterX captcha']
];

/**
 * Why the site refused the crawler, or undefined for a page it served: a refusal status, the Cloudflare challenge
 * header, or a challenge page
 *
 * @param {IFetchedPage} page
 *
 * @returns {string | undefined}
 */
export function detectBlock(page: IFetchedPage): string | undefined {
  if (REFUSAL_STATUSES.has(page.status)) {
    return `HTTP ${page.status}`;
  }

  if (page.headers['cf-mitigated'] === 'challenge') {
    return 'Cloudflare challenge';
  }

  return CHALLENGE_MARKERS.find(([marker]) => page.html.includes(marker))?.[1];
}
