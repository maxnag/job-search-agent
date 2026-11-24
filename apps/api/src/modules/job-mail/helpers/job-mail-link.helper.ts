import type { ILinkCandidate } from '../../search/interfaces/link-candidate.interface.js';
import type { IJobMailLinkRule } from '../interfaces/job-mail-link-rule.interface.js';
import { DEFAULT_LINK_RULE } from '../links/default.link-rule.js';
import { GLASSDOOR_LINK_RULE } from '../links/glassdoor.link-rule.js';
import { LINKEDIN_LINK_RULE } from '../links/linkedin.link-rule.js';
import { unwrapRedirect } from './job-mail-url.helper.js';

/**
 * Rules of the sites with their own, checked in order before the default one
 *
 * @type {readonly IJobMailLinkRule[]}
 */
const SITE_RULES: readonly IJobMailLinkRule[] = [LINKEDIN_LINK_RULE, GLASSDOOR_LINK_RULE];

/**
 * The rule of the host of a link
 *
 * @param {string} url
 *
 * @returns {IJobMailLinkRule}
 */
export function jobMailLinkRule(url: string): IJobMailLinkRule {
  const host = URL.parse(url)?.hostname.toLowerCase() ?? '';

  return SITE_RULES.find(rule => rule.matches(host)) ?? DEFAULT_LINK_RULE;
}

/**
 * True when the crawler must never open the vacancy page of the link (ADR-003)
 *
 * @param {string} url
 *
 * @returns {boolean}
 */
export function isNoFetchURL(url: string): boolean {
  return jobMailLinkRule(url).noFetch;
}

/**
 * The links of a job mail as the LLM may see them: a redirect wrapper unwrapped, the link read by the rule of its
 * site — canonical, without tracking —, subscription and service links dropped, one per address, mail order
 *
 * @param {readonly ILinkCandidate[]} candidates
 *
 * @returns {ILinkCandidate[]}
 */
export function jobMailLinks(candidates: readonly ILinkCandidate[]): ILinkCandidate[] {
  const byURL = new Map<string, ILinkCandidate>();

  for (const candidate of candidates) {
    const parsed = URL.parse(candidate.url);

    if (!parsed) {
      continue;
    }

    const target = unwrapRedirect(parsed);
    const url = jobMailLinkRule(target.href).canonicalURL(target, candidate.text);

    if (!url) {
      continue;
    }

    const known = byURL.get(url);

    if (!known || (!known.text && candidate.text)) {
      byURL.set(url, { ...candidate, url });
    }
  }

  return [...byURL.values()];
}
