import type { MantineColorScheme, MantineColorSchemeManager } from '@mantine/core';

import { COLOR_SCHEME_COOKIE, COLOR_SCHEME_COOKIE_MAX_AGE, parseColorScheme } from './color-scheme.cookie';

/**
 * The cookie of the theme in the browser, if set
 *
 * @returns {string | undefined}
 */
function readCookie(): string | undefined {
  return document.cookie
    .split('; ')
    .find(entry => entry.startsWith(`${COLOR_SCHEME_COOKIE}=`))
    ?.slice(COLOR_SCHEME_COOKIE.length + 1);
}

/**
 * Keeps the theme of Mantine in a cookie instead of the browser storage: the server reads the cookie and renders the
 * same theme and switch the browser will have, so nothing changes after hydration. On the server it answers the
 * default it is given — the one the layout read from the same cookie
 *
 * @returns {MantineColorSchemeManager}
 */
export function cookieColorSchemeManager(): MantineColorSchemeManager {
  return {
    get: (defaultValue: MantineColorScheme): MantineColorScheme => {
      if (typeof document === 'undefined') {
        return defaultValue;
      }

      const value = readCookie();

      return value === undefined ? defaultValue : parseColorScheme(value);
    },
    set: (value: MantineColorScheme): void => {
      document.cookie = `${COLOR_SCHEME_COOKIE}=${value}; path=/; max-age=${COLOR_SCHEME_COOKIE_MAX_AGE}; samesite=lax`;
    },
    subscribe: (): void => undefined,
    unsubscribe: (): void => undefined,
    clear: (): void => {
      document.cookie = `${COLOR_SCHEME_COOKIE}=; path=/; max-age=0; samesite=lax`;
    }
  };
}
