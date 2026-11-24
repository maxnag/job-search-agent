import { isServiceLink, withoutTracking } from '../helpers/job-mail-url.helper.js';
import type { IJobMailLinkRule } from '../interfaces/job-mail-link-rule.interface.js';

/**
 * Rule of every site without its own: tracking dropped, subscription links dropped, the vacancy page opened as usual
 *
 * @type {IJobMailLinkRule}
 */
export const DEFAULT_LINK_RULE: IJobMailLinkRule = {
  name: 'default',
  noFetch: false,

  /**
   * Covers every host
   *
   * @returns {boolean}
   */
  matches(): boolean {
    return true;
  },

  /**
   * The link without tracking; undefined for a subscription link
   *
   * @param {URL} url
   * @param {string} text
   *
   * @returns {string | undefined}
   */
  canonicalURL(url: URL, text: string): string | undefined {
    return isServiceLink(url, text) ? undefined : withoutTracking(url);
  }
};
