import { load } from 'cheerio';

import { HIDDEN_CONTENT } from '../../crawler/helpers/hidden-content.helper.js';
import type { ILinkCandidate } from '../interfaces/link-candidate.interface.js';
import type { ILinkCandidates } from '../interfaces/link-candidates.interface.js';

/**
 * Longest text around a link kept as its context — a card or a table row, not the whole list
 *
 * @type {number}
 */
const CONTEXT_MAX_LENGTH = 300;

/**
 * Protocols of a link to a page
 *
 * @type {ReadonlySet<string>}
 */
const WEB_PROTOCOLS: ReadonlySet<string> = new Set(['http:', 'https:']);

/**
 * Elements whose text is never a part of the page content
 *
 * @type {string}
 */
const NON_CONTENT = 'script, style, noscript, svg, template, iframe';

/**
 * Elements whose text never runs on into its neighbours — a space before and after each keeps the words of a card
 * apart; inline elements such as `span` are left alone, they may split one word
 *
 * @type {string}
 */
const SEPARATED = 'a, p, div, li, br, tr, td, th, h1, h2, h3, h4, h5, h6, section, article, dt, dd, button';

/**
 * Text with every run of whitespace made one space
 *
 * @param {string} text
 *
 * @returns {string}
 */
function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Absolute URL of a link without the fragment, or undefined for anything but a link to another page
 *
 * @param {string | undefined} href
 * @param {string} pageURL
 *
 * @returns {string | undefined}
 */
export function resolveLink(href: string | undefined, pageURL: string): string | undefined {
  const url = href ? URL.parse(href.trim(), pageURL) : null;

  if (!url || !WEB_PROTOCOLS.has(url.protocol)) {
    return undefined;
  }

  url.hash = '';

  const page = URL.parse(pageURL);

  if (page) {
    page.hash = '';
  }

  return url.href === page?.href ? undefined : url.href;
}

/**
 * The links of a listing page with their text and the text around them, one per URL, page order, at most `maxLinks`;
 * cut short when a link is left after the limit. The context is the largest ancestor whose text is still short — the
 * card or the row of the position
 *
 * @param {string} html
 * @param {string} pageURL
 * @param {number} maxLinks
 *
 * @returns {ILinkCandidates}
 */
export function extractLinkCandidates(html: string, pageURL: string, maxLinks: number): ILinkCandidates {
  const $ = load(html);
  const byURL = new Map<string, ILinkCandidate>();
  let truncated = false;

  $(NON_CONTENT).remove();
  $(HIDDEN_CONTENT).replaceWith(' ');
  $(SEPARATED).before(' ').after(' ');

  for (const element of $('a[href]').toArray()) {
    if (byURL.size >= maxLinks) {
      truncated = true;

      break;
    }

    const link = $(element);
    const url = resolveLink(link.attr('href'), pageURL);

    if (!url) {
      continue;
    }

    const text = collapse(link.text()) || collapse(link.attr('aria-label') ?? link.attr('title') ?? '');
    const known = byURL.get(url);

    if (known && known.text !== '') {
      continue;
    }

    let context = '';

    for (const parent of link.parents().toArray()) {
      const parentText = collapse($(parent).text());

      if (parentText.length > CONTEXT_MAX_LENGTH) {
        break;
      }

      context = parentText;
    }

    byURL.set(url, { url, text, context: context === text ? '' : context });
  }

  return { candidates: [...byURL.values()], truncated };
}

/**
 * The links of several pages of one list as one: one per URL — the one with text when a page has it without —, page
 * order, at most `maxLinks`; cut short when a link is left after the limit or a page was cut short itself
 *
 * @param {readonly ILinkCandidates[]} pages Links of each page, in page order
 * @param {number} maxLinks
 *
 * @returns {ILinkCandidates}
 */
export function mergeLinkCandidates(pages: readonly ILinkCandidates[], maxLinks: number): ILinkCandidates {
  const byURL = new Map<string, ILinkCandidate>();
  let truncated = pages.some(page => page.truncated);

  for (const candidate of pages.flatMap(page => page.candidates)) {
    const known = byURL.get(candidate.url);

    if (known && (known.text !== '' || candidate.text === '')) {
      continue;
    }

    if (!known && byURL.size >= maxLinks) {
      truncated = true;

      continue;
    }

    byURL.set(candidate.url, candidate);
  }

  return { candidates: [...byURL.values()], truncated };
}

/**
 * The prompt of the listing step: the page address and one numbered line per link; the URLs are left out when they
 * tell nothing more — the positions of a board are all postings
 *
 * @param {string} pageURL
 * @param {readonly ILinkCandidate[]} candidates
 * @param {boolean} [withURLs]
 *
 * @returns {string}
 */
export function renderLinkCandidates(pageURL: string, candidates: readonly ILinkCandidate[], withURLs = true): string {
  const lines = candidates.map((candidate, index) => {
    const around = candidate.context ? ` | around: ${candidate.context}` : '';
    const url = withURLs ? ` | url: ${candidate.url}` : '';

    return `[${index}] text: ${candidate.text || '(no text)'}${around}${url}`;
  });

  return [`Page: ${pageURL}`, 'Links:', ...lines].join('\n');
}
