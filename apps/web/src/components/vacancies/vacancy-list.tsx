'use client';

import { Badge, Button, Collapse, Group, Stack } from '@mantine/core';
import { IconAdjustmentsHorizontal, IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import type { VacancyFilterOptionsType } from '@/server/schemas/vacancy-filter-options.schema';
import type { VacancyListType } from '@/server/schemas/vacancy-list.schema';
import { FILTER_PANEL_COOKIE, FILTER_PANEL_COOKIE_MAX_AGE, serializeFilterPanelCookie } from '@/vacancies/filter-panel.cookie';
import { useVacancySearch } from '@/vacancies/use-vacancy-search';
import type { VacancySearchType } from '@/vacancies/vacancy-search.schema';

import { VacancyFilters } from './vacancy-filters';
import { VacancyTable } from './vacancy-table';

/**
 * How many filters of the search are in force — an empty list or a missing value is no filter
 *
 * @param {VacancySearchType} search
 *
 * @returns {number}
 */
function countFilters(search: VacancySearchType): number {
  const lists = [search.stage, search.verdict, search.country, search.level, search.lastAction];
  const values = [search.sourceId, search.city, search.workMode, search.sinceDays, search.q, search.reason, search.company, search.closed];

  return lists.filter(values => values.length > 0).length + values.filter(value => value !== undefined).length;
}

/**
 * Props of the list of vacancies
 */
interface IVacancyListProps {
  /**
   * The page the server read for the address
   *
   * @var {VacancyListType}
   */
  readonly list: VacancyListType;

  /**
   * Values the filters offer
   *
   * @var {VacancyFilterOptionsType}
   */
  readonly options: VacancyFilterOptionsType;

  /**
   * Filters of the address
   *
   * @var {VacancySearchType}
   */
  readonly search: VacancySearchType;

  /**
   * The request came from a phone: the filters are compact
   *
   * @var {boolean}
   */
  readonly phone: boolean;

  /**
   * The filters start open — as the owner left them on this kind of device, open on a computer and folded on a phone
   * before the first press
   *
   * @var {boolean}
   */
  readonly filtersOpened: boolean;
}

/**
 * Filters and the table of the list. Both change the address through one transition, so the table dims while the
 * server renders the next page — whichever of them started it. The filters fold away behind a button: open on a
 * computer, folded on a phone — told by the server from the `User-Agent`, so turning the phone changes nothing. The
 * fold is remembered per kind of device in a cookie the server reads, so the page comes folded as it was left; it is
 * a view and never enters the address
 *
 * @param {IVacancyListProps} props
 *
 * @returns {React.JSX.Element}
 */
export function VacancyList({ list, options, search, phone, filtersOpened }: Readonly<IVacancyListProps>): React.JSX.Element {
  const t = useTranslations('vacancies.filters');
  const { isPending, update } = useVacancySearch(search);
  const [opened, setOpened] = useState(filtersOpened);

  /**
   * Fold or unfold the filters and remember it for this kind of device, the other kept
   *
   * @returns {void}
   */
  function toggle(): void {
    const next = !opened;
    const current = document.cookie
      .split('; ')
      .find(entry => entry.startsWith(`${FILTER_PANEL_COOKIE}=`))
      ?.slice(FILTER_PANEL_COOKIE.length + 1);
    const value = serializeFilterPanelCookie(current, phone ? 'phone' : 'desktop', next);

    setOpened(next);
    document.cookie = `${FILTER_PANEL_COOKIE}=${value}; path=/; max-age=${FILTER_PANEL_COOKIE_MAX_AGE}; samesite=lax`;
  }

  return (
    <Stack gap="md">
      <Group>
        <Button
          variant="default"
          size="xs"
          leftSection={<IconAdjustmentsHorizontal size={16} />}
          rightSection={opened ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
          onClick={toggle}
          aria-expanded={opened}>
          {t('toggle')}
          <Badge size="sm" circle ml={6}>
            {countFilters(search)}
          </Badge>
        </Button>
      </Group>
      <Collapse expanded={opened}>
        <VacancyFilters search={search} options={options} compact={phone} onChange={update} />
      </Collapse>
      <VacancyTable list={list} search={search} fetching={isPending} onChange={update} />
    </Stack>
  );
}
