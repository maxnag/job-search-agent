import { load } from 'cheerio';

import { HIDDEN_CONTENT } from '../../crawler/helpers/hidden-content.helper.js';
import type { ILinkCandidate } from '../interfaces/link-candidate.interface.js';

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
function resolveLink(href: string | undefined, pageURL: string): string | undefined {
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
 * The links of a listing page with their text and the text around them, one per URL, page order, at most `maxLinks`.
 * The context is the largest ancestor whose text is still short — the card or the row of the position
 *
 * @param {string} html
 * @param {string} pageURL
 * @param {number} maxLinks
 *
 * @returns {ILinkCandidate[]}
 */
export function extractLinkCandidates(html: string, pageURL: string, maxLinks: number): ILinkCandidate[] {
  const $ = load(html);
  const byURL = new Map<string, ILinkCandidate>();

  $(NON_CONTENT).remove();
  $(HIDDEN_CONTENT).replaceWith(' ');

  for (const element of $('a[href]').toArray()) {
    if (byURL.size >= maxLinks) {
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

  return [...byURL.values()];
}

/**
 * The prompt of the listing step: the page address and one numbered line per link
 *
 * @param {string} pageURL
 * @param {readonly ILinkCandidate[]} candidates
 *
 * @returns {string}
 */
export function renderLinkCandidates(pageURL: string, candidates: readonly ILinkCandidate[]): string {
  const lines = candidates.map((candidate, index) => {
    const around = candidate.context ? ` | around: ${candidate.context}` : '';

    return `[${index}] text: ${candidate.text || '(no text)'}${around} | url: ${candidate.url}`;
  });

  return [`Page: ${pageURL}`, 'Links:', ...lines].join('\n');
}
