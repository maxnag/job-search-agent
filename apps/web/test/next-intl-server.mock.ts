import { createFormatter, createTranslator } from 'next-intl';
import { vi } from 'vitest';

import en from '../messages/en.json';
import { formats } from '../src/i18n/formats';

/**
 * Stand-in for `next-intl/server` in a spec: `getTranslations` gives the real English dictionary under the namespace
 * the code asks for, `getFormatter` the named formats in UTC. A spec replaces the module with
 * `vi.mock('next-intl/server', () => import(…this file))`
 */
export const getTranslations = vi.fn(async (namespace?: string): Promise<(key: string) => string> => {
  const translate = createTranslator({ locale: 'en', messages: en, namespace: namespace as never });

  return Promise.resolve(translate as unknown as (key: string) => string);
});

/**
 * Formatter of the English interface with the named formats, dates in UTC
 */
export const getFormatter = vi.fn(async () => Promise.resolve(createFormatter({ locale: 'en', formats, timeZone: 'UTC' })));
