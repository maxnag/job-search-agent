import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { VacancyActionKindEnum, VacancyMatchVerdictEnum, VacancyStageEnum, WorkModeEnum } from '@job-agent/shared';

import type { VacancyListType } from '@/server/schemas/vacancy-list.schema';
import { parseVacancySearch } from '@/vacancies/vacancy-search.helper';

import { renderWithProviders } from '../../../test/render';
import { VacancyList } from './vacancy-list';

const replace = vi.fn();

vi.mock('@/i18n/navigation', async importOriginal => ({
  ...(await importOriginal<typeof import('@/i18n/navigation')>()),
  useRouter: () => ({ replace }),
  usePathname: () => '/vacancies'
}));

const LIST: VacancyListType = {
  total: 26,
  page: 1,
  pageSize: 25,
  vacancies: [
    {
      vacancyId: 7,
      title: 'Backend Developer',
      company: 'Northwind',
      city: 'Haifa',
      country: 'IL',
      workMode: WorkModeEnum.HYBRID,
      level: null,
      stage: VacancyStageEnum.EXTRACTED,
      source: 'Northwind',
      firstSeenAt: '2026-11-20T18:43:00.000Z',
      lastAction: VacancyActionKindEnum.INTERESTED,
      verdicts: [{ profile: 'developer', verdict: VacancyMatchVerdictEnum.FIT, findings: [] }]
    }
  ]
};

const OPTIONS = {
  sources: [{ sourceId: 3, name: 'Northwind' }],
  countries: ['IL', 'UA'],
  cities: [
    { country: 'IL', city: 'Haifa' },
    { country: 'UA', city: 'Kyiv' }
  ]
};

/**
 * Render the list with the defaults of an empty address
 *
 * @param {{ phone?: boolean, filtersOpened?: boolean, query?: Record<string, string> }} [options]
 * @param options.phone
 * @param options.filtersOpened
 * @param options.query
 *
 * @returns {void}
 */
function renderList(options: { phone?: boolean; filtersOpened?: boolean; query?: Record<string, string> } = {}): void {
  renderWithProviders(
    <VacancyList
      list={LIST}
      options={OPTIONS}
      search={parseVacancySearch(options.query ?? {})}
      phone={options.phone ?? false}
      filtersOpened={options.filtersOpened ?? true}
    />
  );
}

describe('VacancyList', () => {
  afterEach(() => {
    replace.mockReset();
    document.cookie = 'jsa-filters-open=; path=/; max-age=0';
  });

  it('shows a row per vacancy: the title links to the card, the place starts with the country, the time has 24 hours', () => {
    renderList();

    const row = screen.getByRole('link', { name: 'Backend Developer' }).closest('tr') as HTMLElement;

    expect(screen.getByRole('link', { name: 'Backend Developer' }).getAttribute('href')).toBe('/en/vacancies/7');
    expect(within(row).getByText('IL, Haifa')).toBeDefined();
    expect(within(row).getByText('Hybrid')).toBeDefined();
    expect(within(row).getByText('Nov 20, 2026, 18:43')).toBeDefined();
    expect(within(row).getByText('Interested')).toBeDefined();
  });

  it('carries the filters of the list into the link of the card', () => {
    renderList({ query: { country: '', page: '2' } });

    expect(screen.getByRole('link', { name: 'Backend Developer' }).getAttribute('href')).toBe(
      `/en/vacancies/7?from=${encodeURIComponent('country=&page=2')}`
    );
  });

  it('counts the filters in force on the button', () => {
    renderList();

    expect(screen.getByRole('button', { name: /^Filters/ }).textContent).toBe('Filters6');
  });

  it('opens the next page through the address', async () => {
    renderList();

    await userEvent.click(screen.getByRole('button', { name: '2' }));

    expect(replace).toHaveBeenCalledWith('/vacancies?page=2', { scroll: false });
  });

  it('sorts by a column through the address, back on the first page', async () => {
    renderList({ query: { page: '2' } });

    await userEvent.click(screen.getByText('Title'));

    expect(replace).toHaveBeenCalledWith('/vacancies?sort=title', { scroll: false });
  });

  it('brings every filter back to its default', async () => {
    renderList({ query: { country: '', q: 'react', workMode: 'remote' } });

    await userEvent.click(screen.getByRole('button', { name: 'Default filters' }));

    expect(replace).toHaveBeenCalledWith('/vacancies', { scroll: false });
  });

  it('applies the search a moment after the owner stops typing', async () => {
    renderList();

    await userEvent.type(screen.getByLabelText('Title or company'), 'react');

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/vacancies?q=react', { scroll: false });
    });
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it('folds the filters and remembers it for this kind of device, the other kept', async () => {
    document.cookie = 'jsa-filters-open=phone:1; path=/';
    renderList();

    const toggle = screen.getByRole('button', { name: /^Filters/ });

    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    await userEvent.click(toggle);

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.cookie).toContain('jsa-filters-open=phone:1|desktop:0');
  });

  it('comes folded on a phone with compact fields and remembers an unfold as the phone', async () => {
    renderList({ phone: true, filtersOpened: false });

    const toggle = screen.getByRole('button', { name: /^Filters/ });

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByLabelText('Title or company').closest('[data-size]')?.getAttribute('data-size')).toBe('xs');

    await userEvent.click(toggle);

    expect(document.cookie).toContain('jsa-filters-open=phone:1');
  });
});
