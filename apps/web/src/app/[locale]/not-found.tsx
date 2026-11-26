import { Stack, Text, Title } from '@mantine/core';
import { getTranslations } from 'next-intl/server';

import { ButtonLink } from '@/components/button-link';

/**
 * Page for an address that does not exist, in the language of the address
 *
 * @returns {Promise<React.JSX.Element>}
 */
export default async function NotFoundPage(): Promise<React.JSX.Element> {
  const t = await getTranslations('errors');

  return (
    <Stack gap="sm" align="flex-start">
      <Title order={2}>{t('notFoundTitle')}</Title>
      <Text c="dimmed">{t('notFoundDescription')}</Text>
      <ButtonLink href="/vacancies" variant="light">
        {t('home')}
      </ButtonLink>
    </Stack>
  );
}
