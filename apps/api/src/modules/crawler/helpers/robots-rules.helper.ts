import type { IRobotsRule } from '../interfaces/robots-rule.interface.js';

/**
 * The user-agent group the crawler obeys: it presents itself as a regular browser, so only the rules for everyone
 *
 * @type {string}
 */
const ANY_AGENT = '*';

/**
 * Largest robots.txt read, as RFC 9309 allows a crawler to cap it (500 KiB)
 *
 * @type {number}
 */
export const ROBOTS_MAX_LENGTH = 500 * 1024;

/**
 * Characters a regular expression treats specially
 *
 * @type {RegExp}
 */
const REGEXP_SPECIAL = /[.+?^{}()|[\]\\]/g;

/**
 * Rules of the `*` groups of a robots.txt (RFC 9309): consecutive `User-agent` lines open one group, several `*`
 * groups are merged, `Sitemap` and unknown lines are ignored, an empty `Disallow` forbids nothing
 *
 * @param {string} text
 *
 * @returns {IRobotsRule[]}
 */
export function parseRobotsRules(text: string): IRobotsRule[] {
  const rules: IRobotsRule[] = [];
  let groupAgents: string[] = [];
  let inRules = false;

  for (const rawLine of text.slice(0, ROBOTS_MAX_LENGTH).split(/\r?\n/)) {
    const comment = rawLine.indexOf('#');
    const line = (comment === -1 ? rawLine : rawLine.slice(0, comment)).trim();
    const separator = line.indexOf(':');

    if (separator <= 0) {
      continue;
    }

    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (key === 'user-agent') {
      if (inRules) {
        groupAgents = [];
        inRules = false;
      }

      groupAgents.push(value.toLowerCase());

      continue;
    }

    if (key !== 'allow' && key !== 'disallow') {
      continue;
    }

    inRules = true;

    if (groupAgents.includes(ANY_AGENT) && value !== '') {
      rules.push({ allow: key === 'allow', pattern: value });
    }
  }

  return rules;
}

/**
 * Whether a rule's pattern matches a path from its start: `*` is any run of characters, a trailing `$` anchors the end
 *
 * @param {string} pattern
 * @param {string} path
 *
 * @returns {boolean}
 */
function matches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith('$');
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const source = body.replace(REGEXP_SPECIAL, '\\$&').replaceAll('*', '.*');

  return new RegExp(`^${source}${anchored ? '$' : ''}`).test(path);
}

/**
 * Whether the rules let the crawler fetch a path (path and query): the longest matching pattern wins, `Allow` wins a
 * tie, no matching rule allows. `/robots.txt` itself is always allowed
 *
 * @param {readonly IRobotsRule[]} rules
 * @param {string} path
 *
 * @returns {boolean}
 */
export function isPathAllowed(rules: readonly IRobotsRule[], path: string): boolean {
  if (path === '/robots.txt') {
    return true;
  }

  let winner: IRobotsRule | undefined;

  for (const rule of rules) {
    if (!matches(rule.pattern, path)) {
      continue;
    }

    const longer = !winner || rule.pattern.length > winner.pattern.length;
    const allowsTie = winner !== undefined && rule.pattern.length === winner.pattern.length && rule.allow;

    if (longer || allowsTie) {
      winner = rule;
    }
  }

  return winner?.allow ?? true;
}
