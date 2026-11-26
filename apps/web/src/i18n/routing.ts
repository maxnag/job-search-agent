import { defineRouting } from 'next-intl/routing';

/**
 * Languages of the interface: always in the address (`/en/…`, `/uk/…`), so a shared link opens in the same language
 */
export const routing = defineRouting({
  locales: ['en', 'uk'],
  defaultLocale: 'en',
  localePrefix: 'always'
});
