import { describe, expect, it, vi } from 'vitest';

import LocaleLayout, { generateMetadata, generateStaticParams } from './layout';

vi.mock('next-intl/server', () => import('../../../test/next-intl-server.mock'));

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
    const page = await LocaleLayout(propsFor('uk'));

    expect(page.type).toBe('html');
    expect((page.props as { lang: string }).lang).toBe('uk');
  });

  it('answers "not found" for a language it does not know', async () => {
    await expect(LocaleLayout(propsFor('de'))).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404');
  });
});
