import { Stack, Text, Title } from '@mantine/core';
import { getTranslations } from 'next-intl/server';

import { ButtonLink } from '@/components/button-link';

/**
 * Shown for a vacancy the API does not have
 *
 * @returns {Promise<React.JSX.Element>}
 */
export default async function VacancyNotFound(): Promise<React.JSX.Element> {
  const t = await getTranslations('vacancies.card');

  return (
    <Stack gap="xs" align="flex-start">
      <Title order={2}>{t('notFoundTitle')}</Title>
      <Text c="dimmed">{t('notFoundDescription')}</Text>
      <ButtonLink href="/vacancies" variant="light">
        {t('back')}
      </ButtonLink>
    </Stack>
  );
}
