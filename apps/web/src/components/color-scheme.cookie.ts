import type { MantineColorScheme } from '@mantine/core';

/**
 * Name of the cookie with the theme the owner chose — the server reads it, so the page comes in that theme and with
 * the switch drawn. Prefixed with the project: the projects on `localhost` share the cookies of the host
 *
 * @type {string}
 */
export const COLOR_SCHEME_COOKIE = 'jsa-color-scheme';

/**
 * How long the cookie lives, in seconds — a year
 *
 * @type {number}
 */
export const COLOR_SCHEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * The theme a cookie value names, or `auto` — the system one — for anything else
 *
 * @param {string | undefined} value
 *
 * @returns {MantineColorScheme}
 */
export function parseColorScheme(value: string | undefined): MantineColorScheme {
  return value === 'light' || value === 'dark' ? value : 'auto';
}
