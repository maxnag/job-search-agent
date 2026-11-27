import { ColorSchemeScript, mantineHtmlProps } from '@mantine/core';
import '@mantine/core/styles.css';
import 'mantine-datatable/styles.css';
import type { Metadata } from 'next';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { APIStatus, APIStatusFallback } from '@/components/a-p-i-status';
import { AppLayout } from '@/components/app-layout';
import { COLOR_SCHEME_COOKIE, parseColorScheme } from '@/components/color-scheme.cookie';
import { ThemeProvider } from '@/components/theme-provider';
import { routing } from '@/i18n/routing';
import { isPhone } from '@/server/device';

/**
 * Both languages are known in advance — Next builds a variant of the frame for each
 *
 * @returns {{ locale: string }[]}
 */
export function generateStaticParams(): { locale: string }[] {
  return routing.locales.map(locale => ({ locale }));
}

/**
 * Title of the browser tab in the language of the page: a page names itself, the template adds the application;
 * a page without a title of its own gets the application name alone
 *
 * @returns {Promise<Metadata>}
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('app');

  return { title: { template: `%s · ${t('title')}`, default: t('title') } };
}

/**
 * Root layout: the `<html>` of every page in its language, the theme, the dictionary for client components and the
 * frame. The API state streams in later through Suspense, the frame does not wait for it
 *
 * @param {LayoutProps<'/[locale]'>} props
 *
 * @returns {Promise<React.JSX.Element>}
 */
export default async function LocaleLayout({ children, params }: LayoutProps<'/[locale]'>): Promise<React.JSX.Element> {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const [phone, jar] = await Promise.all([isPhone(), cookies()]);
  const colorScheme = parseColorScheme(jar.get(COLOR_SCHEME_COOKIE)?.value);

  return (
    <html lang={locale} {...mantineHtmlProps} data-mantine-color-scheme={colorScheme === 'auto' ? 'light' : colorScheme}>
      <head>
        <ColorSchemeScript defaultColorScheme={colorScheme} localStorageKey={COLOR_SCHEME_COOKIE} />
      </head>
      <body>
        <ThemeProvider colorScheme={colorScheme}>
          <NextIntlClientProvider>
            <AppLayout
              phone={phone}
              apiStatus={
                <Suspense fallback={<APIStatusFallback compact={phone} />}>
                  <APIStatus compact={phone} />
                </Suspense>
              }>
              {children}
            </AppLayout>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
