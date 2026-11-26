import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePathname, useSearchParams } from 'next/navigation';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getPathname } from '@/i18n/navigation';

import { renderWithProviders } from '../../test/render';
import { LocaleSwitcher } from './locale-switcher';

vi.mock(import('@/i18n/navigation'), async importOriginal => {
  const actual = await importOriginal();

  return { ...actual, getPathname: vi.fn(actual.getPathname) };
});

describe('LocaleSwitcher', () => {
  beforeEach(() => {
    vi.mocked(usePathname).mockReturnValue('/en/vacancies');
  });

  afterEach(() => {
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as never);
    vi.mocked(getPathname).mockClear();
  });

  it('offers both languages and marks the current one', () => {
    renderWithProviders(<LocaleSwitcher />);

    expect(screen.getByRole<HTMLInputElement>('radio', { name: 'EN' }).checked).toBe(true);
    expect(screen.getByRole<HTMLInputElement>('radio', { name: 'UK' }).checked).toBe(false);
    expect(screen.getByRole('radiogroup', { name: 'Language' })).toBeDefined();
  });

  it('builds the address of the same page in the chosen language', async () => {
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams('verdict=fit&tag=a&tag=b') as never);

    renderWithProviders(<LocaleSwitcher />);
    await userEvent.click(screen.getByRole('radio', { name: 'UK' }));

    expect(getPathname).toHaveBeenCalledWith({ href: '/vacancies', locale: 'uk' });
    expect(vi.mocked(getPathname).mock.results[0]?.value).toBe('/uk/vacancies');
  });
});
