import { cookies } from 'next/headers';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { VacancyList } from '@/components/vacancies/vacancy-list';
import { getVacancies, getVacancyFilterOptions } from '@/server/a-p-i-client';
import { isPhone } from '@/server/device';

import VacanciesPage, { generateMetadata } from './page';

vi.mock('next-intl/server', () => import('../../../../test/next-intl-server.mock'));
vi.mock('next/headers', () => ({ cookies: vi.fn() }));
vi.mock('@/server/device', () => ({ isPhone: vi.fn() }));
vi.mock('@/server/a-p-i-client', () => ({ getVacancies: vi.fn(), getVacancyFilterOptions: vi.fn() }));

const LIST = { total: 3, page: 1, pageSize: 25, vacancies: [] };
const OPTIONS = { sources: [], countries: [], cities: [] };

/**
 * Render the page for an address of a device, with the cookie of the fold
 *
 * @param {Record<string, string>} query
 * @param {boolean} phone
 * @param {string} [fold]
 *
 * @returns {Promise<React.JSX.Element>}
 */
async function renderPage(query: Record<string, string>, phone: boolean, fold?: string): Promise<React.JSX.Element> {
  vi.mocked(getVacancies).mockResolvedValue(LIST);
  vi.mocked(getVacancyFilterOptions).mockResolvedValue(OPTIONS);
  vi.mocked(isPhone).mockResolvedValue(phone);
  vi.mocked(cookies).mockResolvedValue({ get: () => (fold === undefined ? undefined : { value: fold }) } as never);

  return VacanciesPage({ params: Promise.resolve({ locale: 'en' }), searchParams: Promise.resolve(query) });
}

/**
 * The props the page gives the client list
 *
 * @param {React.JSX.Element} page
 *
 * @returns {Record<string, unknown>}
 */
function listProps(page: React.JSX.Element): Record<string, unknown> {
  const children = (page.props as { children: React.JSX.Element[] }).children;
  const list = children.find(child => child.type === VacancyList);

  return list?.props as Record<string, unknown>;
}

describe('VacanciesPage', () => {
  afterEach(() => {
    vi.mocked(getVacancies).mockReset();
  });

  it('names the tab after the section', async () => {
    await expect(generateMetadata()).resolves.toEqual({ title: 'Vacancies' });
  });

  it('asks the API with every filter in force, the defaults of the page included', async () => {
    await renderPage({ country: '', q: 'react' }, false);

    const query = vi.mocked(getVacancies).mock.calls[0]?.[0];

    expect(query?.has('country')).toBe(false);
    expect(query?.get('q')).toBe('react');
    expect(query?.getAll('stage')).toEqual(['listed', 'extracted']);
    expect(query?.get('sinceDays')).toBe('3');
  });

  it('hands the list, the filters and the device to the client list', async () => {
    const props = listProps(await renderPage({}, true));

    expect(props).toMatchObject({ list: LIST, options: OPTIONS, phone: true });
    expect(props.search).toMatchObject({ country: ['IL', 'UA'] });
  });

  it.each([
    ['open on a computer with no cookie', false, undefined, true],
    ['folded on a phone with no cookie', true, undefined, false],
    ['as the computer left it', false, 'phone:1|desktop:0', false],
    ['as the phone left it', true, 'phone:1|desktop:0', true]
  ])('starts the filters %s', async (_case, phone, fold, expected) => {
    expect(listProps(await renderPage({}, phone, fold)).filtersOpened).toBe(expected);
  });
});
