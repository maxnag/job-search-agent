import { createHash } from 'node:crypto';

import { load } from 'cheerio';

import { HIDDEN_CONTENT } from '../../crawler/helpers/hidden-content.helper.js';

/**
 * Elements that never hold the posting: code, styles, navigation, page chrome
 *
 * @type {string}
 */
const NON_CONTENT = 'script, style, noscript, svg, template, iframe, nav, header, footer';

/**
 * Elements that end a line of text
 *
 * @type {string}
 */
const BLOCKS = 'p, div, li, br, tr, h1, h2, h3, h4, h5, h6, section, article, dt, dd';

/**
 * Text of a vacancy page: the `main` or `article` element when the page has one, the body otherwise, without hidden
 * elements; one line per block, whitespace collapsed, empty lines dropped, at most `maxChars`
 *
 * @param {string} html
 * @param {number} maxChars
 *
 * @returns {string}
 */
export function vacancyPageText(html: string, maxChars: number): string {
  const $ = load(html);

  $(NON_CONTENT).remove();
  $(HIDDEN_CONTENT).replaceWith(' ');
  $(BLOCKS).after('\n');

  const root = ['main', 'article', 'body'].map(selector => $(selector).first()).find(element => element.length > 0);
  const text = (root ?? $.root()).text();

  return text
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(line => line !== '')
    .join('\n')
    .slice(0, maxChars);
}

/**
 * SHA-256 of the text — the same text is the same vacancy, no LLM call
 *
 * @param {string} text
 *
 * @returns {string}
 */
export function textHash(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}
