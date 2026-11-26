import { Stack, Text, Title } from '@mantine/core';
import { getTranslations } from 'next-intl/server';

/**
 * Props of an empty section
 */
interface ISectionPlaceholderProps {
  /**
   * Section whose title and text are shown
   *
   * @var {'vacancies' | 'companies' | 'sources'}
   */
  readonly section: 'vacancies' | 'companies' | 'sources';
}

/**
 * Title and a note of a section that has no data yet
 *
 * @param {ISectionPlaceholderProps} props
 *
 * @returns {Promise<React.JSX.Element>}
 */
export async function SectionPlaceholder({ section }: ISectionPlaceholderProps): Promise<React.JSX.Element> {
  const t = await getTranslations(`pages.${section}`);

  return (
    <Stack gap="xs">
      <Title order={2}>{t('title')}</Title>
      <Text c="dimmed">{t('empty')}</Text>
    </Stack>
  );
}
