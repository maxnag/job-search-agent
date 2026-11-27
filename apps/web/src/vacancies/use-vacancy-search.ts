'use client';

import { useTransition } from 'react';

import { usePathname, useRouter } from '@/i18n/navigation';

import { toVacancyQuery } from './vacancy-search.helper';
import type { VacancySearchType } from './vacancy-search.schema';

/**
 * What the list of vacancies needs to change its address
 */
interface IVacancySearchControl {
  /**
   * True while the page of the new address is loading
   *
   * @var {boolean}
   */
  readonly isPending: boolean;

  /**
   * Open the list with some filters changed — the first page, unless the page itself is the change
   *
   * @var {(changes: Partial<VacancySearchType>) => void}
   */
  readonly update: (changes: Partial<VacancySearchType>) => void;
}

/**
 * Change the filters of the list through the address: the server component reads them back and renders the new page.
 * The change runs in a transition — the current page stays on screen, dimmed, until the new one is ready
 *
 * @param {VacancySearchType} search The filters of the page shown now
 *
 * @returns {IVacancySearchControl}
 */
export function useVacancySearch(search: VacancySearchType): IVacancySearchControl {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  /**
   * Open the list with the changes
   *
   * @param {Partial<VacancySearchType>} changes
   *
   * @returns {void}
   */
  function update(changes: Partial<VacancySearchType>): void {
    const query = toVacancyQuery({ ...search, page: 1, ...changes }).toString();

    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  return { isPending, update };
}
