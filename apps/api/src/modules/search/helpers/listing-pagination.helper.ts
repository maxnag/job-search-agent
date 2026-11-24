import { type CheerioAPI, load } from 'cheerio';

import { HIDDEN_CONTENT } from '../../crawler/helpers/hidden-content.helper.js';
import type { IListingPagination } from '../interfaces/listing-pagination.interface.js';
import { resolveLink } from './listing-page.helper.js';

/**
 * Query parameters that number the pages of a list, lower-cased
 *
 * @type {ReadonlySet<string>}
 */
const PAGE_PARAMS: ReadonlySet<string> = new Set(['page', 'p', 'pg', 'pagenumber']);

/**
 * Query parameters that count the positions skipped before a page, lower-cased
 *
 * @type {ReadonlySet<string>}
 */
const OFFSET_PARAMS: ReadonlySet<string> = new Set(['offset', 'start']);

/**
 * A path that ends with the page number — `…/page/2`
 *
 * @type {RegExp}
 */
const PAGE_PATH = /\/page\/(\d+)\/?$/;

/**
 * Key of the page number taken from the path, next to the parameter names
 *
 * @type {string}
 */
const PATH_MARK = '/page/';

/**
 * A page number or an offset
 *
 * @type {RegExp}
 */
const DIGITS = /^\d+$/;

/**
 * Text of a link or a button that loads the rest of the list, lower-cased, without the marks around the words
 *
 * @type {ReadonlySet<string>}
 */
const LOAD_MORE_PHRASES: ReadonlySet<string> = new Set([
  'load more',
  'load more jobs',
  'load more positions',
  'show more',
  'show more jobs',
  'show more positions',
  'view more',
  'view more jobs',
  'see more',
  'see more jobs',
  'more jobs',
  'more positions',
  'more openings'
]);

/**
 * Text that names the next page outright — the only "next" a button may say: a bare "Next" button is usually a slider
 * of photos or quotes, not the list
 *
 * @type {readonly string[]}
 */
const NEXT_PAGE_PHRASES: readonly string[] = [
  'next page',
  'go to next page',
  'לעמוד הבא',
  'העמוד הבא',
  'наступна сторінка',
  'на наступну сторінку'
];

/**
 * Text of a link to the next page — the page phrases and the bare word, in English, Hebrew and Ukrainian
 *
 * @type {ReadonlySet<string>}
 */
const NEXT_LINK_PHRASES: ReadonlySet<string> = new Set([...NEXT_PAGE_PHRASES, 'next', 'הבא', 'наступна', 'далі']);

/**
 * A letter or a digit — what is left of a phrase once the arrows, dots and spaces around it are cut
 *
 * @type {RegExp}
 */
const WORD_CHARACTER = /[\p{L}\p{N}]/u;

/**
 * Links that name the next page themselves
 *
 * @type {string}
 */
const REL_NEXT = 'a[rel~="next" i][href], link[rel~="next" i][href]';

/**
 * A link of the same origin that numbers a page, and by how many pages it is ahead of the current one
 */
interface IPageLink {
  /**
   * Absolute address of the link
   *
   * @var {string}
   */
  readonly url: string;

  /**
   * Pages it is ahead of the current one; an offset counts positions, not pages
   *
   * @var {number}
   */
  readonly ahead: number;
}

/**
 * What a link or a button says, and where a link leads
 */
interface IPhrasedElement {
  /**
   * Its text or label, lower-cased, without the marks around the words
   *
   * @var {string}
   */
  readonly phrase: string;

  /**
   * Its `href`, as written
   *
   * @var {string}
   */
  readonly href?: string;
}

/**
 * What the `rel="next"` links of a page say
 */
interface IRelNext {
  /**
   * True when the page has such a link, of any origin
   *
   * @var {boolean}
   */
  readonly found: boolean;

  /**
   * Address of the first one of the same origin
   *
   * @var {string}
   */
  readonly nextURL?: string;
}

/**
 * Page numbers and offsets an address carries, by parameter name (`/page/` for the path)
 *
 * @param {URL} url
 *
 * @returns {Map<string, number>}
 */
function pageMarks(url: URL): Map<string, number> {
  const marks = new Map<string, number>();

  for (const [name, value] of url.searchParams) {
    const key = name.toLowerCase();

    if ((PAGE_PARAMS.has(key) || OFFSET_PARAMS.has(key)) && DIGITS.test(value)) {
      marks.set(key, +value);
    }
  }

  const pathNumber = PAGE_PATH.exec(url.pathname)?.[1];

  if (pathNumber !== undefined) {
    marks.set(PATH_MARK, +pathNumber);
  }

  return marks;
}

/**
 * Number of the current page by one mark: from its address, else the first — an offset of 0, page 0 when the links
 * count pages from 0, else page 1
 *
 * @param {string} key
 * @param {ReadonlyMap<string, number>} current Marks of the page address
 * @param {ReadonlyArray<ReadonlyMap<string, number>>} linked Marks of the links
 *
 * @returns {number}
 */
function currentNumber(key: string, current: ReadonlyMap<string, number>, linked: ReadonlyArray<ReadonlyMap<string, number>>): number {
  const own = current.get(key);

  if (own !== undefined) {
    return own;
  }

  if (OFFSET_PARAMS.has(key)) {
    return 0;
  }

  return linked.some(marks => marks.get(key) === 0) ? 0 : 1;
}

/**
 * Links of the same origin with a page number or an offset past the current page; the closest one first
 *
 * @param {CheerioAPI} $
 * @param {URL} page
 *
 * @returns {IPageLink[]}
 */
function pageLinks($: CheerioAPI, page: URL): IPageLink[] {
  const links = $('a[href]')
    .toArray()
    .map(element => resolveLink($(element).attr('href'), page.href))
    .flatMap(href => {
      const url = href ? URL.parse(href) : null;

      return url && url.origin === page.origin ? [{ url, marks: pageMarks(url) }] : [];
    })
    .filter(link => link.marks.size > 0);
  const current = pageMarks(page);
  const linked = links.map(link => link.marks);
  const ahead = links.flatMap(link => {
    const steps = [...link.marks].map(([key, number]) => number - currentNumber(key, current, linked)).filter(step => step > 0);

    return steps.length > 0 ? [{ url: link.url.href, ahead: Math.min(...steps) }] : [];
  });

  return ahead.sort((left, right) => left.ahead - right.ahead);
}

/**
 * The address a `rel="next"` link names, when it is of the same origin
 *
 * @param {CheerioAPI} $
 * @param {URL} page
 *
 * @returns {IRelNext}
 */
function relNext($: CheerioAPI, page: URL): IRelNext {
  const links = $(REL_NEXT).toArray();

  for (const element of links) {
    const href = resolveLink($(element).attr('href'), page.href);

    if (href && URL.parse(href)?.origin === page.origin) {
      return { found: true, nextURL: href };
    }
  }

  return { found: links.length > 0 };
}

/**
 * Text lower-cased, whitespace collapsed, without the marks around the words
 *
 * @param {string} text
 *
 * @returns {string}
 */
function normalizePhrase(text: string): string {
  const characters = [...text.replace(/\s+/g, ' ').toLowerCase()];
  const first = characters.findIndex(character => WORD_CHARACTER.test(character));

  if (first === -1) {
    return '';
  }

  const last = characters.findLastIndex(character => WORD_CHARACTER.test(character));

  return characters.slice(first, last + 1).join('');
}

/**
 * What a link or a button says — its words, else its label when the text is only marks — so `Next ›` and an arrow `›`
 * labeled `Next` read the same
 *
 * @param {string} text
 * @param {string | undefined} label `aria-label`, else `title`
 *
 * @returns {string}
 */
function phraseOf(text: string, label: string | undefined): string {
  return normalizePhrase(text) || normalizePhrase(label ?? '');
}

/**
 * The phrase of every element a selector finds
 *
 * @param {CheerioAPI} $
 * @param {string} selector
 *
 * @returns {IPhrasedElement[]}
 */
function phrases($: CheerioAPI, selector: string): IPhrasedElement[] {
  return $(selector)
    .toArray()
    .map(element => {
      const node = $(element);

      return { phrase: phraseOf(node.text(), node.attr('aria-label') ?? node.attr('title')), href: node.attr('href') };
    });
}

/**
 * The address of a link of the same origin whose text says it leads to the next page
 *
 * @param {CheerioAPI} $
 * @param {URL} page
 *
 * @returns {string | undefined}
 */
function nextByText($: CheerioAPI, page: URL): string | undefined {
  for (const link of phrases($, 'a[href]')) {
    if (!NEXT_LINK_PHRASES.has(link.phrase)) {
      continue;
    }

    const href = resolveLink(link.href, page.href);

    if (href && URL.parse(href)?.origin === page.origin) {
      return href;
    }
  }

  return undefined;
}

/**
 * True when a visible link or button loads the rest of the list ("Load more"), or a visible button names the next page
 *
 * @param {CheerioAPI} $
 *
 * @returns {boolean}
 */
function hasMoreButton($: CheerioAPI): boolean {
  $(HIDDEN_CONTENT).remove();

  const loadsMore = phrases($, 'a, button').some(element => LOAD_MORE_PHRASES.has(element.phrase));

  return loadsMore || phrases($, 'button').some(element => NEXT_PAGE_PHRASES.includes(element.phrase));
}

/**
 * Pagination of a listing page, or undefined when the page shows the whole list. Signs, any of them: a `rel="next"`
 * link; a link of the same origin whose text says "Next" (English, Hebrew, Ukrainian); a link of the same origin — any
 * path — with a page number or an offset past the current page, or a path ending in `/page/<N>`; a visible link or
 * button such as "Load more", or a button that says "Next page". The next page is the one `rel="next"` names, else the
 * "Next" link, else the closest numbered one; a button gives no address. A false sign only delays a closing until the
 * vacancy page is read, a missed one closes a vacancy that is open — so the signs are wide
 *
 * @param {string} html
 * @param {string} pageURL
 *
 * @returns {IListingPagination | undefined}
 */
export function findPagination(html: string, pageURL: string): IListingPagination | undefined {
  const page = URL.parse(pageURL);

  if (!page) {
    return undefined;
  }

  const $ = load(html);
  const rel = relNext($, page);
  const [closest] = pageLinks($, page);
  const nextURL = rel.nextURL ?? nextByText($, page) ?? closest?.url;

  if (nextURL) {
    return { nextURL };
  }

  return rel.found || hasMoreButton($) ? {} : undefined;
}
