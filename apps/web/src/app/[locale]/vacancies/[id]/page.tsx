import { Stack } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { ButtonLink } from '@/components/button-link';
import { VacancyCard } from '@/components/vacancies/vacancy-card';
import { getVacancy } from '@/server/a-p-i-client';
import { parseVacancySearch, toVacancyQuery } from '@/vacancies/vacancy-search.helper';

/**
 * The vacancy id of the address; undefined for anything but a positive whole number
 *
 * @param {string} id
 *
 * @returns {number | undefined}
 */
function vacancyIdOf(id: string): number | undefined {
  return /^[1-9]\d*$/.test(id) ? +id : undefined;
}

/**
 * Title of the browser tab — the title of the vacancy
 *
 * @param {PageProps<'/[locale]/vacancies/[id]'>} props
 *
 * @returns {Promise<Metadata>}
 */
export async function generateMetadata({ params }: PageProps<'/[locale]/vacancies/[id]'>): Promise<Metadata> {
  const vacancyId = vacancyIdOf((await params).id);
  const vacancy = vacancyId === undefined ? undefined : await getVacancy(vacancyId).catch(() => undefined);

  if (vacancy) {
    return { title: `${vacancy.title} · ${vacancy.company}` };
  }

  const t = await getTranslations('pages.vacancy');

  return { title: t('title') };
}

/**
 * Card of a vacancy at `/vacancies/<id>`. `from` carries the filters of the list it was opened from — read through
 * the same schema as the list, so only known filters go back into the link
 *
 * @param {PageProps<'/[locale]/vacancies/[id]'>} props
 *
 * @returns {Promise<React.JSX.Element>}
 */
export default async function VacancyPage({
  params,
  searchParams
}: Readonly<PageProps<'/[locale]/vacancies/[id]'>>): Promise<React.JSX.Element> {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const vacancyId = vacancyIdOf(id);
  const vacancy = vacancyId === undefined ? undefined : await getVacancy(vacancyId);

  if (!vacancy) {
    notFound();
  }

  const t = await getTranslations('vacancies.card');
  const from = typeof query.from === 'string' ? toVacancyQuery(parseVacancySearch(new URLSearchParams(query.from))).toString() : '';

  return (
    <Stack gap="md">
      <ButtonLink
        href={from ? `/vacancies?${from}` : '/vacancies'}
        variant="subtle"
        leftSection={<IconArrowLeft size={16} />}
        w="fit-content"
        px="xs">
        {t('back')}
      </ButtonLink>
      <VacancyCard vacancy={vacancy} />
    </Stack>
  );
}
