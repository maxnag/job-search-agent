'use client';

import { Button, Stack, Text, Title } from '@mantine/core';
import { useTranslations } from 'next-intl';

/**
 * Props Next.js gives an error boundary
 */
interface IErrorPageProps {
  /**
   * The error; in production its message is hidden, only the digest is kept
   *
   * @var {Error & { digest?: string }}
   */
  readonly error: Error & { digest?: string };

  /**
   * Render the segment again
   *
   * @var {() => void}
   */
  readonly reset: () => void;
}

/**
 * Error boundary of a page: an error while rendering shows this instead of the page, the frame stays. A client
 * component — the retry button needs a click handler
 *
 * @param {IErrorPageProps} props
 *
 * @returns {React.JSX.Element}
 */
export default function ErrorPage({ reset }: IErrorPageProps): React.JSX.Element {
  const t = useTranslations('errors');

  return (
    <Stack gap="sm" align="flex-start">
      <Title order={2}>{t('title')}</Title>
      <Text c="dimmed">{t('description')}</Text>
      <Button onClick={reset} variant="light">
        {t('retry')}
      </Button>
    </Stack>
  );
}
