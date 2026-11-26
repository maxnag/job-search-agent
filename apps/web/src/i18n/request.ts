import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import * as rootParams from 'next/root-params';

import { routing } from './routing';

/**
 * Language and dictionary of the current request: the language comes from the `[locale]` segment, an unknown one
 * falls back to the default
 */
export default getRequestConfig(async ({ locale }) => {
  const requested = locale ?? (await rootParams.locale());
  const current = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const messages = (await import(`../../messages/${current}.json`)) as { default: Record<string, unknown> };

  return { locale: current, messages: messages.default };
});
