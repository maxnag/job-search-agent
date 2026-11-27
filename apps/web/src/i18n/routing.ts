import { defineRouting } from 'next-intl/routing';

/**
 * Languages of the interface: always in the address (`/en/…`, `/uk/…`), so a shared link opens in the same language.
 * The cookie of the last choice carries the project prefix — every project on `localhost` shares the cookies of the
 * host, whatever its port, and `NEXT_LOCALE` is the default name of every next-intl app
 */
export const routing = defineRouting({
  locales: ['en', 'uk'],
  defaultLocale: 'en',
  localePrefix: 'always',
  localeCookie: { name: 'jsa-locale' }
});
