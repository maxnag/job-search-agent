import { isHostOf } from '../helpers/job-mail-url.helper.js';
import type { IJobMailLinkRule } from '../interfaces/job-mail-link-rule.interface.js';

/**
 * Path of a LinkedIn vacancy, the job id in the first group; `/comm/` is the prefix of the links in its e-mails
 *
 * @type {RegExp}
 */
const JOB_PATH = /^\/(?:comm\/)?jobs\/view\/(?:[^/]*?-)?(\d+)\/?$/;

/**
 * LinkedIn: only the links to a vacancy are kept, as `https://www.linkedin.com/jobs/view/<id>/`; the crawler never
 * opens them (ADR-003) — the owner does, from the card
 *
 * @type {IJobMailLinkRule}
 */
export const LINKEDIN_LINK_RULE: IJobMailLinkRule = {
  name: 'linkedin',
  noFetch: true,

  /**
   * Covers linkedin.com and its subdomains
   *
   * @param {string} host
   *
   * @returns {boolean}
   */
  matches(host: string): boolean {
    return isHostOf(host, 'linkedin.com');
  },

  /**
   * The canonical link of a vacancy; undefined for any other link of the site
   *
   * @param {URL} url
   *
   * @returns {string | undefined}
   */
  canonicalURL(url: URL): string | undefined {
    const jobId = JOB_PATH.exec(url.pathname)?.[1];

    return jobId ? `https://www.linkedin.com/jobs/view/${jobId}/` : undefined;
  }
};
