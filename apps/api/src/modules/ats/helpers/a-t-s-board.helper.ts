import { ATSKindEnum } from '@job-agent/shared';

import type { IATSBoard } from '../interfaces/a-t-s-board.interface.js';

/**
 * A board name: a site name, a board token or a Comeet slug
 *
 * @type {RegExp}
 */
const BOARD_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

/**
 * A Comeet company uid, such as `06.004`
 *
 * @type {RegExp}
 */
const COMEET_UID = /^[0-9A-Fa-f]{2}\.[0-9A-Fa-f]{3}$/;

/**
 * First path segments of a Greenhouse host that are pages of the site, not boards
 *
 * @type {ReadonlySet<string>}
 */
const GREENHOUSE_RESERVED = new Set(['embed', 'v1']);

/**
 * Hosts of the Greenhouse job boards
 *
 * @type {ReadonlySet<string>}
 */
const GREENHOUSE_HOSTS: ReadonlySet<string> = new Set(['job-boards.greenhouse.io', 'boards.greenhouse.io']);

/**
 * Hosts of the Lever job sites (the EU region is not supported)
 *
 * @type {ReadonlySet<string>}
 */
const LEVER_HOSTS: ReadonlySet<string> = new Set(['jobs.lever.co']);

/**
 * Hosts of the Comeet hosted pages
 *
 * @type {ReadonlySet<string>}
 */
const COMEET_HOSTS: ReadonlySet<string> = new Set(['www.comeet.com', 'comeet.com', 'www.comeet.co', 'comeet.co']);

/**
 * Path segment Comeet hosted pages start with
 *
 * @type {string}
 */
const COMEET_JOBS = 'jobs';

/**
 * The board a link leads to — a link to the board itself or to one of its positions; `undefined` for a link that is
 * not a supported applicant tracking system
 *
 * @param {string} url
 *
 * @returns {IATSBoard | undefined}
 */
export function parseATSBoard(url: string): IATSBoard | undefined {
  const parsed = URL.parse(url);

  if (!parsed || parsed.protocol !== 'https:') {
    return undefined;
  }

  const host = parsed.hostname.toLowerCase();
  const segments = parsed.pathname.split('/').filter(segment => segment !== '');

  if (GREENHOUSE_HOSTS.has(host)) {
    return greenhouseBoard(parsed, segments);
  }

  if (LEVER_HOSTS.has(host)) {
    return boardOf(ATSKindEnum.LEVER, segments[0]);
  }

  if (COMEET_HOSTS.has(host)) {
    return comeetBoard(segments);
  }

  return undefined;
}

/**
 * What tells one board from another: the board name, and for Comeet only the company uid — a company may have
 * several slugs that all lead to one board
 *
 * @param {IATSBoard} board
 *
 * @returns {string}
 */
export function boardIdentity(board: IATSBoard): string {
  const name = board.kind === ATSKindEnum.COMEET ? (board.board.split('/').at(-1) ?? board.board).toUpperCase() : board.board;

  return `${board.kind}:${name}`;
}

/**
 * Canonical link of a board — the one a source keeps
 *
 * @param {IATSBoard} board
 *
 * @returns {string}
 */
export function boardURL(board: IATSBoard): string {
  switch (board.kind) {
    case ATSKindEnum.GREENHOUSE: {
      return `https://job-boards.greenhouse.io/${board.board}`;
    }

    case ATSKindEnum.LEVER: {
      return `https://jobs.lever.co/${board.board}`;
    }

    case ATSKindEnum.COMEET: {
      return `https://www.comeet.com/${COMEET_JOBS}/${board.board}`;
    }
  }
}

/**
 * The Greenhouse board of a link: `/<board>/…`, or the embedded board `/embed/job_board?for=<board>`
 *
 * @param {URL} url
 * @param {readonly string[]} segments
 *
 * @returns {IATSBoard | undefined}
 */
function greenhouseBoard(url: URL, segments: readonly string[]): IATSBoard | undefined {
  const [first] = segments;

  if (first === 'embed') {
    return boardOf(ATSKindEnum.GREENHOUSE, url.searchParams.get('for') ?? undefined);
  }

  if (!first || GREENHOUSE_RESERVED.has(first)) {
    return undefined;
  }

  return boardOf(ATSKindEnum.GREENHOUSE, first);
}

/**
 * The Comeet board of a link: `/jobs/<slug>/<company uid>/…`; the uid is kept in upper case — Comeet ignores its case
 *
 * @param {readonly string[]} segments
 *
 * @returns {IATSBoard | undefined}
 */
function comeetBoard(segments: readonly string[]): IATSBoard | undefined {
  const [jobs, slug, uid] = segments;

  if (jobs !== COMEET_JOBS || !slug || !uid || !BOARD_NAME.test(slug) || !COMEET_UID.test(uid)) {
    return undefined;
  }

  return { kind: ATSKindEnum.COMEET, board: `${slug}/${uid.toUpperCase()}` };
}

/**
 * A board of a system, if the name is a valid board name; Greenhouse ignores the case of a board token and is kept in
 * lower case, Lever and Comeet names are case-sensitive and kept as written
 *
 * @param {ATSKindEnum} kind
 * @param {string | undefined} name
 *
 * @returns {IATSBoard | undefined}
 */
function boardOf(kind: ATSKindEnum, name: string | undefined): IATSBoard | undefined {
  if (!name || !BOARD_NAME.test(name)) {
    return undefined;
  }

  return { kind, board: kind === ATSKindEnum.GREENHOUSE ? name.toLowerCase() : name };
}
