import { cookies, headers } from 'next/headers';
import { describe, expect, it, vi } from 'vitest';

import LocaleLayout, { generateMetadata, generateStaticParams } from './layout';

vi.mock('next-intl/server', () => import('../../../test/next-intl-server.mock'));
vi.mock('next/headers', () => ({ headers: vi.fn(), cookies: vi.fn() }));

/**
 * A request from a browser with the cookies given
 *
 * @param {Record<string, string>} jar
 * @param {string} [agent]
 *
 * @returns {void}
 */
function request(jar: Record<string, string>, agent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'): void {
  vi.mocked(headers).mockResolvedValue(new Headers({ 'user-agent': agent }));
  vi.mocked(cookies).mockResolvedValue({ get: (name: string) => (name in jar ? { name, value: jar[name] } : undefined) } as never);
}

/**
 * Props of the layout for a language of the address
 *
 * @param {string} locale
 *
 * @returns {LayoutProps<'/[locale]'>}
 */
function propsFor(locale: string): LayoutProps<'/[locale]'> {
  return { children: <p>page</p>, params: Promise.resolve({ locale }) };
}

describe('LocaleLayout', () => {
  it('builds a frame for each language in advance', () => {
    expect(generateStaticParams()).toEqual([{ locale: 'en' }, { locale: 'uk' }]);
  });

  it('names the tab after the page and the application, or the application alone', async () => {
    await expect(generateMetadata()).resolves.toEqual({
      title: { template: '%s · Job Search Agent', default: 'Job Search Agent' }
    });
  });

  it('marks the document with the language of the address', async () => {
    request({});

    const page = await LocaleLayout(propsFor('uk'));

    expect(page.type).toBe('html');
    expect((page.props as { lang: string }).lang).toBe('uk');
  });

  it.each([
    ['the light theme of the cookie', 'light', 'light'],
    ['the dark theme of the cookie', 'dark', 'dark'],
    ['light until the script reads the system theme, with no cookie', undefined, 'light']
  ])('marks the document with %s', async (_case, cookie, expected) => {
    request(cookie === undefined ? {} : { 'jsa-color-scheme': cookie });

    const page = await LocaleLayout(propsFor('en'));

    expect((page.props as Record<string, unknown>)['data-mantine-color-scheme']).toBe(expected);
  });

  it('answers "not found" for a language it does not know', async () => {
    await expect(LocaleLayout(propsFor('de'))).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404');
  });
});
