import { MantineProvider } from '@mantine/core';
import { type RenderResult, render } from '@testing-library/react';
import { type Locale, NextIntlClientProvider } from 'next-intl';

import en from '../messages/en.json';
import uk from '../messages/uk.json';
import { formats } from '../src/i18n/formats';

const MESSAGES = { en, uk } as const;

/**
 * Render a component the way the layout wraps it: the Mantine theme, the dictionary of the language and the named
 * formats; dates in UTC, so a spec reads the same on any machine
 *
 * @param {React.ReactNode} ui
 * @param {Locale} locale
 *
 * @returns {RenderResult}
 */
export function renderWithProviders(ui: React.ReactNode, locale: Locale = 'en'): RenderResult {
  return render(
    <MantineProvider>
      <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} formats={formats} timeZone="UTC">
        {ui}
      </NextIntlClientProvider>
    </MantineProvider>
  );
}
