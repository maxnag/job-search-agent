import { type Cheerio, type CheerioAPI, load } from 'cheerio';

import { HIDDEN_CONTENT } from '../../crawler/helpers/hidden-content.helper.js';
import type { IListingPagination } from '../interfaces/listing-pagination.interface.js';
import { resolveLink } from './listing-page.helper.js';

/**
 * Query parameters that number the pages of a list, lower-cased
 *
 * @type {ReadonlySet<string>}
 */
const PAGE_PARAMS: ReadonlySet<string> = new Set([
  'page',
  'p',
  'pg',
  'pagenumber',
  'paged',
  'pageindex',
  'page_no',
  'pageno',
  'pn',
  'currentpage'
]);

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
 * Text of a page number in a row of numbers — up to three digits, so a row of years is not a pagination
 *
 * @type {RegExp}
 */
const PAGE_NUMBER_TEXT = /^\d{1,3}$/;

/**
 * Numbers a row needs to be a pagination — one number alone is a footnote or a badge
 *
 * @type {number}
 */
const MIN_ROW_NUMBERS = 2;

/**
 * Elements that mark the current page, unless they say `false`
 *
 * @type {string}
 */
const CURRENT_PAGE = '[aria-current]:not([aria-current="false" i])';

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
 * Elements selected by cheerio, as its traversal returns them — cheerio does not export the element type itself
 */
type ElementSelection = ReturnType<Cheerio<never>['parent']>;

/**
 * A sign of pagination of one kind, and the address of the next page it gives
 */
interface IPaginationSign {
  /**
   * True when the page has the sign
   *
   * @var {boolean}
   */
  readonly found: boolean;

  /**
   * Address of the next page, of the same origin; absent when the sign gives none
   *
   * @var {string}
   */
  readonly nextURL?: string;
}

/**
 * An element of a row of page numbers
 */
interface IRowNumber {
  /**
   * The number it shows
   *
   * @var {number}
   */
  readonly number: number;

  /**
   * Address of the page it leads to, of the same origin, other than the current page; absent for the current page and
   * for a number only a script follows
   *
   * @var {string}
   */
  readonly url?: string;

  /**
   * True when it is a link or a button — a number a reader can click
   *
   * @var {boolean}
   */
  readonly clickable: boolean;

  /**
   * True when it is marked as the current page
   *
   * @var {boolean}
   */
  readonly current: boolean;
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
 * Links of the same origin with a page number or an offset past the current page. The next page is the closest of
 * them that may be followed: a page number only one page ahead — a farther one would skip a page, and `?p=<id>` of
 * WordPress is a post, not a page; an offset any step ahead — it counts positions, not pages
 *
 * @param {CheerioAPI} $
 * @param {URL} page
 *
 * @returns {IPaginationSign}
 */
function pageLinks($: CheerioAPI, page: URL): IPaginationSign {
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
  let found = false;
  let next: { readonly url: string; readonly ahead: number } | undefined;

  for (const link of links) {
    for (const [key, number] of link.marks) {
      const ahead = number - currentNumber(key, current, linked);

      if (ahead <= 0) {
        continue;
      }

      found = true;

      if ((OFFSET_PARAMS.has(key) || ahead === 1) && (!next || ahead < next.ahead)) {
        next = { url: link.url.href, ahead };
      }
    }
  }

  return { found, nextURL: next?.url };
}

/**
 * The address a `rel="next"` link names, when it is of the same origin
 *
 * @param {CheerioAPI} $
 * @param {URL} page
 *
 * @returns {IPaginationSign}
 */
function relNext($: CheerioAPI, page: URL): IPaginationSign {
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
 * True when a link or a button loads the rest of the list ("Load more"), or a button names the next page; the hidden
 * ones are removed before
 *
 * @param {CheerioAPI} $
 *
 * @returns {boolean}
 */
function hasMoreButton($: CheerioAPI): boolean {
  const loadsMore = phrases($, 'a, button').some(element => LOAD_MORE_PHRASES.has(element.phrase));

  return loadsMore || phrases($, 'button').some(element => NEXT_PAGE_PHRASES.includes(element.phrase));
}

/**
 * The item of a row an element stands for: the element, or its wrapper when it is the wrapper's only child — the
 * `li` of a `li > a`
 *
 * @param {ElementSelection} node
 *
 * @returns {ElementSelection}
 */
function rowItem(node: ElementSelection): ElementSelection {
  let item = node;

  while (item.parent().length > 0 && item.parent().children().length === 1 && !item.parent().is('body')) {
    item = item.parent();
  }

  return item;
}

/**
 * True when an address may name the page a row number shows: it carries no page number, or the same one — or one
 * less, for a list counted from 0
 *
 * @param {string} url
 * @param {number} number
 *
 * @returns {boolean}
 */
function addressMatches(url: string, number: number): boolean {
  const parsed = URL.parse(url);

  if (!parsed) {
    return false;
  }

  return [...pageMarks(parsed)].filter(([key]) => !OFFSET_PARAMS.has(key)).every(([, mark]) => mark === number || mark === number - 1);
}

/**
 * The page number an item of a row shows, with where it leads; undefined when the item shows no number
 *
 * @param {ElementSelection} item
 * @param {URL} page
 *
 * @returns {IRowNumber | undefined}
 */
function rowNumber(item: ElementSelection, page: URL): IRowNumber | undefined {
  const phrase = phraseOf(item.text(), item.attr('aria-label') ?? item.attr('title'));

  if (!PAGE_NUMBER_TEXT.test(phrase)) {
    return undefined;
  }

  const number = +phrase;
  const control = item.is('a, button') ? item : item.find('a, button').first();
  const href = resolveLink(control.attr('href'), page.href);
  const url = href && URL.parse(href)?.origin === page.origin && addressMatches(href, number) ? href : undefined;
  const current = item.is(CURRENT_PAGE) || item.find(CURRENT_PAGE).length > 0;

  return { number, url, clickable: control.length > 0, current };
}

/**
 * Rows of page numbers — the items under one parent that show a number, two or more
 *
 * @param {CheerioAPI} $
 * @param {URL} page
 *
 * @returns {IRowNumber[][]}
 */
function numberRows($: CheerioAPI, page: URL): IRowNumber[][] {
  const parents = new Set(
    $('a, button')
      .toArray()
      .flatMap(element => rowItem($(element)).parent().toArray())
  );

  return [...parents]
    .map(parent =>
      $(parent)
        .children()
        .toArray()
        .flatMap(child => rowNumber($(child), page) ?? [])
    )
    .filter(row => row.length >= MIN_ROW_NUMBERS);
}

/**
 * Pagination drawn as a row of numbers — "1 2 3 … 10" — whatever the addresses look like. The current page is the
 * number marked `aria-current`, else the number that is no link, else 1; the next page is the number after it. A row
 * whose numbers lead nowhere a crawler can follow — buttons or links without an address — is only a sign: a script
 * turns its pages
 *
 * @param {CheerioAPI} $
 * @param {URL} page
 *
 * @returns {IPaginationSign}
 */
function rowPagination($: CheerioAPI, page: URL): IPaginationSign {
  let found = false;

  for (const row of numberRows($, page)) {
    const linked = row.filter(item => item.url !== undefined);

    if (linked.length === 0) {
      found ||= row.filter(item => item.clickable).length >= MIN_ROW_NUMBERS;

      continue;
    }

    const currentNumber = (row.find(item => item.current) ?? row.find(item => item.url === undefined))?.number ?? 1;

    if (!row.some(item => item.number > currentNumber)) {
      continue;
    }

    found = true;

    const next = linked.find(item => item.number === currentNumber + 1);

    if (next?.url) {
      return { found, nextURL: next.url };
    }
  }

  return { found };
}

/**
 * Pagination of a listing page, or undefined when the page shows the whole list. Signs, any of them: a `rel="next"`
 * link; a link of the same origin whose text says "Next" (English, Hebrew, Ukrainian); a link of the same origin — any
 * path — with a page number or an offset past the current page, or a path ending in `/page/<N>`; a visible row of two
 * or more page numbers with one past the current page, or of numbered buttons; a visible link or button such as
 * "Load more", or a button that says "Next page". The next page is the one `rel="next"` names, else the "Next" link,
 * else the numbered link one page ahead (an offset — the closest ahead), else the number after the current one in a
 * row; a button gives no address, nor does a page number further ahead — following it would skip a page. A false sign
 * only delays a closing until the vacancy page is read, a missed one closes a vacancy that is open — so the signs are
 * wide, and the address narrow
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
  const byText = nextByText($, page);
  const numbered = pageLinks($, page);

  $(HIDDEN_CONTENT).remove();

  const row = rowPagination($, page);
  const nextURL = rel.nextURL ?? byText ?? numbered.nextURL ?? row.nextURL;

  if (nextURL) {
    return { nextURL };
  }

  return rel.found || numbered.found || row.found || hasMoreButton($) ? {} : undefined;
}
