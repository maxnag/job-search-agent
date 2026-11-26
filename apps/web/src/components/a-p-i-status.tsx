import { Badge } from '@mantine/core';
import { getTranslations } from 'next-intl/server';

import { getAPIHealth } from '@/server/a-p-i-client';
import { APIHealthStatusEnum } from '@/server/a-p-i-health-status.enum';

/**
 * Colour of the badge for each state of the API
 *
 * @type {Readonly<Record<APIHealthStatusEnum, string>>}
 */
const COLORS: Readonly<Record<APIHealthStatusEnum, string>> = {
  [APIHealthStatusEnum.OK]: 'teal',
  [APIHealthStatusEnum.DEGRADED]: 'yellow',
  [APIHealthStatusEnum.DOWN]: 'red'
};

/**
 * Dictionary key of the badge text for each state of the API
 *
 * @type {Readonly<Record<APIHealthStatusEnum, 'ok' | 'degraded' | 'down'>>}
 */
const LABELS: Readonly<Record<APIHealthStatusEnum, 'ok' | 'degraded' | 'down'>> = {
  [APIHealthStatusEnum.OK]: 'ok',
  [APIHealthStatusEnum.DEGRADED]: 'degraded',
  [APIHealthStatusEnum.DOWN]: 'down'
};

/**
 * Badge with the state of the API — an async server component: it awaits the API on the server, the browser gets
 * the finished badge
 *
 * @returns {Promise<React.JSX.Element>}
 */
export async function APIStatus(): Promise<React.JSX.Element> {
  const [status, t] = await Promise.all([getAPIHealth(), getTranslations('apiStatus')]);

  return (
    <Badge color={COLORS[status]} variant="light">
      {t(LABELS[status])}
    </Badge>
  );
}

/**
 * Badge shown while the state of the API is not known yet — the fallback of the Suspense boundary
 *
 * @returns {Promise<React.JSX.Element>}
 */
export async function APIStatusFallback(): Promise<React.JSX.Element> {
  const t = await getTranslations('apiStatus');

  return (
    <Badge color="gray" variant="light">
      {t('checking')}
    </Badge>
  );
}
