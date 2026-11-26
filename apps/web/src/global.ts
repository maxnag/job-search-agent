import type messages from '../messages/en.json';
import type { routing } from './i18n/routing';

declare module 'next-intl' {
  /**
   * Types of next-intl: a language outside the list or a missing key of the dictionary does not compile
   */
  interface AppConfig {
    /**
     * Languages of the interface
     *
     * @var {string}
     */
    Locale: (typeof routing.locales)[number];

    /**
     * Shape of the dictionary, taken from the English one
     *
     * @var {object}
     */
    Messages: typeof messages;
  }
}
