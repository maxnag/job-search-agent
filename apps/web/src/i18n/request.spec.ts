import { locale as rootLocale } from 'next/root-params';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import en from '../../messages/en.json';
import uk from '../../messages/uk.json';
import requestConfig from './request';

vi.mock('next-intl/server', () => ({ getRequestConfig: (factory: unknown) => factory }));
vi.mock('next/root-params', () => ({ locale: vi.fn() }));

/**
 * The factory `getRequestConfig` receives, called the way next-intl calls it
 */
const loadConfig = requestConfig as unknown as (params: { locale?: string }) => Promise<{ locale: string; messages: unknown }>;

describe('request config', () => {
  const rootLocaleMock = vi.mocked(rootLocale);

  beforeEach(() => {
    rootLocaleMock.mockReset();
  });

  it('takes the language of the address and its dictionary', async () => {
    rootLocaleMock.mockResolvedValue('uk');

    await expect(loadConfig({})).resolves.toEqual({ locale: 'uk', messages: uk });
  });

  it('prefers the language next-intl was given explicitly', async () => {
    rootLocaleMock.mockResolvedValue('uk');

    await expect(loadConfig({ locale: 'en' })).resolves.toEqual({ locale: 'en', messages: en });
    expect(rootLocaleMock).not.toHaveBeenCalled();
  });

  it.each([
    ['an unknown language', 'de'],
    ['no language', undefined]
  ])('falls back to English for %s', async (_case, value) => {
    rootLocaleMock.mockResolvedValue(value as never);

    await expect(loadConfig({})).resolves.toEqual({ locale: 'en', messages: en });
  });
});
