import { Stack, Text, Title } from '@mantine/core';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';

import { VacancyList } from '@/components/vacancies/vacancy-list';
import { getVacancies, getVacancyFilterOptions } from '@/server/a-p-i-client';
import { isPhone } from '@/server/device';
import { FILTER_PANEL_COOKIE, parseFilterPanelCookie } from '@/vacancies/filter-panel.cookie';
import { parseVacancySearch, toVacancyAPIQuery } from '@/vacancies/vacancy-search.helper';

/**
 * Title of the browser tab
 *
 * @returns {Promise<Metadata>}
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('pages.vacancies');

  return { title: t('title') };
}

/**
 * Section vacancies: the filters come from the address, the server reads the page of the list and the values of the
 * filters from the API at once and hands them to the client list, with the fold of the filters this kind of device had
 * last time
 *
 * @param {PageProps<'/[locale]/vacancies'>} props
 *
 * @returns {Promise<React.JSX.Element>}
 */
export default async function VacanciesPage({ searchParams }: Readonly<PageProps<'/[locale]/vacancies'>>): Promise<React.JSX.Element> {
  const search = parseVacancySearch(await searchParams);
  const [t, list, options, phone, jar] = await Promise.all([
    getTranslations('pages.vacancies'),
    getVacancies(toVacancyAPIQuery(search)),
    getVacancyFilterOptions(),
    isPhone(),
    cookies()
  ]);
  const filtersOpened = parseFilterPanelCookie(jar.get(FILTER_PANEL_COOKIE)?.value)[phone ? 'phone' : 'desktop'] ?? !phone;

  return (
    <Stack gap="md">
      <Stack gap={2}>
        <Title order={2}>{t('title')}</Title>
        <Text c="dimmed" size="sm">
          {t('total', { total: list.total })}
        </Text>
      </Stack>
      <VacancyList list={list} options={options} search={search} phone={phone} filtersOpened={filtersOpened} />
    </Stack>
  );
}
