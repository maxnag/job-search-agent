import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePathname } from 'next/navigation';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../test/render';
import { NavLinks } from './nav-links';

describe('NavLinks', () => {
  beforeEach(() => {
    vi.mocked(usePathname).mockReturnValue('/en/companies');
  });

  it('links every section under the language of the page', () => {
    renderWithProviders(<NavLinks />);

    expect(screen.getByRole('link', { name: 'Vacancies' }).getAttribute('href')).toBe('/en/vacancies');
    expect(screen.getByRole('link', { name: 'Companies' }).getAttribute('href')).toBe('/en/companies');
    expect(screen.getByRole('link', { name: 'Sources' }).getAttribute('href')).toBe('/en/sources');
  });

  it('marks the current section, including a page inside it', () => {
    vi.mocked(usePathname).mockReturnValue('/en/companies/42');

    renderWithProviders(<NavLinks />);

    expect(screen.getByRole('link', { name: 'Companies' }).hasAttribute('data-active')).toBe(true);
    expect(screen.getByRole('link', { name: 'Vacancies' }).hasAttribute('data-active')).toBe(false);
  });

  it('shows the Ukrainian names under /uk', () => {
    vi.mocked(usePathname).mockReturnValue('/uk/vacancies');

    renderWithProviders(<NavLinks />, 'uk');

    expect(screen.getByRole('link', { name: 'Вакансії' }).getAttribute('href')).toBe('/uk/vacancies');
  });

  it('tells the layout a link was chosen, so the mobile menu closes', async () => {
    const onNavigate = vi.fn();

    renderWithProviders(<NavLinks onNavigate={onNavigate} />);
    window.addEventListener('click', event => event.preventDefault(), { once: true });
    await userEvent.click(screen.getByRole('link', { name: 'Sources' }));

    expect(onNavigate).toHaveBeenCalledOnce();
  });
});
