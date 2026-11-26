'use client';

import { SegmentedControl } from '@mantine/core';
import { type Locale, useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';

import { getPathname, usePathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

/**
 * Switch of the interface language. The address keeps its path and its query string — the filters stay. The language
 * is the root of the layout, so the page loads anew instead of a client-side transition: the whole document changes
 *
 * @returns {React.JSX.Element}
 */
export function LocaleSwitcher(): React.JSX.Element {
  const t = useTranslations('locale');
  const locale = useLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  /**
   * Open the same address in another language
   *
   * @param {string} next
   *
   * @returns {void}
   */
  function switchTo(next: string): void {
    const query = searchParams.toString();
    const path = getPathname({ href: pathname, locale: next as Locale });

    window.location.assign(query ? `${path}?${query}` : path);
  }

  return (
    <SegmentedControl
      size="xs"
      aria-label={t('label')}
      value={locale}
      onChange={switchTo}
      data={routing.locales.map(value => ({ value, label: value.toUpperCase() }))}
    />
  );
}
