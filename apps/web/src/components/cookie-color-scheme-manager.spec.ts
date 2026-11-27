import { afterEach, describe, expect, it } from 'vitest';

import { COLOR_SCHEME_COOKIE, parseColorScheme } from './color-scheme.cookie';
import { cookieColorSchemeManager } from './cookie-color-scheme-manager';

/**
 * Remove the cookie of the theme from the jsdom document
 *
 * @returns {void}
 */
function clearCookie(): void {
  document.cookie = `${COLOR_SCHEME_COOKIE}=; path=/; max-age=0`;
}

describe('parseColorScheme', () => {
  it.each([
    ['light', 'light'],
    ['dark', 'dark'],
    ['auto', 'auto'],
    [undefined, 'auto'],
    ['sepia', 'auto']
  ])('reads %s as %s', (value, expected) => {
    expect(parseColorScheme(value)).toBe(expected);
  });
});

describe('cookieColorSchemeManager', () => {
  afterEach(() => {
    clearCookie();
  });

  it('keeps the theme in the prefixed cookie', () => {
    expect(COLOR_SCHEME_COOKIE).toBe('jsa-color-scheme');
  });

  it('answers the default while no theme is chosen', () => {
    expect(cookieColorSchemeManager().get('auto')).toBe('auto');
  });

  it('stores the chosen theme and reads it back', () => {
    const manager = cookieColorSchemeManager();

    manager.set('dark');

    expect(document.cookie).toContain('jsa-color-scheme=dark');
    expect(manager.get('auto')).toBe('dark');
  });

  it('reads a broken cookie as the system theme', () => {
    document.cookie = `${COLOR_SCHEME_COOKIE}=sepia; path=/`;

    expect(cookieColorSchemeManager().get('light')).toBe('auto');
  });

  it('forgets the theme on clear', () => {
    const manager = cookieColorSchemeManager();

    manager.set('dark');
    manager.clear();

    expect(manager.get('light')).toBe('light');
  });
});
