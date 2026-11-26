import { MantineProvider } from '@mantine/core';
import { type RenderResult, render } from '@testing-library/react';
import { type Locale, NextIntlClientProvider } from 'next-intl';

import en from '../messages/en.json';
import uk from '../messages/uk.json';

const MESSAGES = { en, uk } as const;

/**
 * Render a component the way the layout wraps it: the Mantine theme and the dictionary of the language
 *
 * @param {React.ReactNode} ui
 * @param {Locale} locale
 *
 * @returns {RenderResult}
 */
export function renderWithProviders(ui: React.ReactNode, locale: Locale = 'en'): RenderResult {
  return render(
    <MantineProvider>
      <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>
        {ui}
      </NextIntlClientProvider>
    </MantineProvider>
  );
}
