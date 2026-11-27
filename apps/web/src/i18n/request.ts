import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import * as rootParams from 'next/root-params';

import { formats } from './formats';
import { routing } from './routing';

/**
 * Language, dictionary and time zone of the current request: the language comes from the `[locale]` segment, an
 * unknown one falls back to the default. The time zone is the one of the machine the web runs on — the owner's — and
 * reaches the client components with the dictionary, so a date reads the same on the server and in the browser
 */
export default getRequestConfig(async ({ locale }) => {
  const requested = locale ?? (await rootParams.locale());
  const current = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const messages = (await import(`../../messages/${current}.json`)) as { default: Record<string, unknown> };

  return { locale: current, messages: messages.default, formats, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
});
