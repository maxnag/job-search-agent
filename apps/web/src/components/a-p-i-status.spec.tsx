import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { getAPIHealth } from '@/server/a-p-i-client';
import { APIHealthStatusEnum } from '@/server/a-p-i-health-status.enum';

import { renderWithProviders } from '../../test/render';
import { APIStatus, APIStatusFallback } from './a-p-i-status';

vi.mock('next-intl/server', () => import('../../test/next-intl-server.mock'));
vi.mock('@/server/a-p-i-client', () => ({ getAPIHealth: vi.fn() }));

describe('APIStatus', () => {
  it.each([
    [APIHealthStatusEnum.OK, 'API: running', 'teal'],
    [APIHealthStatusEnum.DEGRADED, 'API: running, but a database, Redis or the LLM is not', 'yellow'],
    [APIHealthStatusEnum.DOWN, 'API: not reachable', 'red']
  ])('shows %s as its text in its colour', async (status, text, color) => {
    vi.mocked(getAPIHealth).mockResolvedValue(status);

    renderWithProviders(await APIStatus({}));

    const badge = screen.getByText(text).closest('.mantine-Badge-root');

    expect(badge?.getAttribute('style')).toContain(`--mantine-color-${color}`);
  });
});

describe('APIStatusFallback', () => {
  it('shows a grey "checking" while the API is asked', async () => {
    renderWithProviders(await APIStatusFallback({}));

    const badge = screen.getByText('API: checking…').closest('.mantine-Badge-root');

    expect(badge?.getAttribute('style')).toContain('--mantine-color-gray');
  });
});

describe('APIStatus on a phone', () => {
  it('shows only the word API, the state in its colour and in the title', async () => {
    vi.mocked(getAPIHealth).mockResolvedValue(APIHealthStatusEnum.DOWN);

    renderWithProviders(await APIStatus({ compact: true }));

    const badge = screen.getByText('API').closest('.mantine-Badge-root');

    expect(badge?.getAttribute('style')).toContain('--mantine-color-red');
    expect(badge?.getAttribute('title')).toBe('API: not reachable');
  });

  it('shows only the word API while the API is asked', async () => {
    renderWithProviders(await APIStatusFallback({ compact: true }));

    expect(screen.getByText('API').closest('.mantine-Badge-root')?.getAttribute('title')).toBe('API: checking…');
  });
});
