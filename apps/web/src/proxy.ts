import createMiddleware from 'next-intl/middleware';

import { routing } from './i18n/routing';

/**
 * Puts the language into the address: `/` and an address without a language go to the language of the cookie or of
 * the browser, `en` otherwise
 */
export default createMiddleware(routing);

/**
 * Addresses the proxy runs on: everything except Next internals and files
 *
 * @type {{ matcher: string }}
 */
export const config = {
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)'
};
