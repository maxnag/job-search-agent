import { afterEach, describe, expect, it, vi } from 'vitest';

import { ButtonLink } from '@/components/button-link';
import { VacancyCard } from '@/components/vacancies/vacancy-card';
import { getVacancy } from '@/server/a-p-i-client';
import type { VacancyCardType } from '@/server/schemas/vacancy-card.schema';

import VacancyPage, { generateMetadata } from './page';

vi.mock('next-intl/server', () => import('../../../../../test/next-intl-server.mock'));
vi.mock('@/server/a-p-i-client', () => ({ getVacancy: vi.fn() }));

const CARD = { vacancyId: 7, title: 'Backend Developer', company: 'Northwind' } as VacancyCardType;

/**
 * Props of the page for an id and a query of the address
 *
 * @param {string} id
 * @param {Record<string, string>} [query]
 *
 * @returns {never}
 */
function propsFor(id: string, query: Record<string, string> = {}): never {
  return { params: Promise.resolve({ locale: 'en', id }), searchParams: Promise.resolve(query) } as never;
}

/**
 * The address of the link back to the list
 *
 * @param {React.JSX.Element} page
 *
 * @returns {string | undefined}
 */
function backLink(page: React.JSX.Element): string | undefined {
  const children = (page.props as { children: React.JSX.Element[] }).children;

  return (children.find(child => child.type === ButtonLink)?.props as { href?: string } | undefined)?.href;
}

describe('VacancyPage', () => {
  afterEach(() => {
    vi.mocked(getVacancy).mockReset();
  });

  it('names the tab after the vacancy', async () => {
    vi.mocked(getVacancy).mockResolvedValue(CARD);

    await expect(generateMetadata(propsFor('7'))).resolves.toEqual({ title: 'Backend Developer · Northwind' });
  });

  it.each([
    ['an unknown vacancy', '7', undefined],
    ['an id that is no number', 'seven', CARD],
    ['an API that fails', '7', 'fail']
  ])('names the tab "Vacancy" for %s', async (_case, id, answer) => {
    if (answer === 'fail') {
      vi.mocked(getVacancy).mockRejectedValue(new Error('down'));
    } else {
      vi.mocked(getVacancy).mockResolvedValue(answer as VacancyCardType | undefined);
    }

    await expect(generateMetadata(propsFor(id))).resolves.toEqual({ title: 'Vacancy' });
  });

  it('shows the card of the vacancy', async () => {
    vi.mocked(getVacancy).mockResolvedValue(CARD);

    const page = await VacancyPage(propsFor('7'));
    const children = (page.props as { children: React.JSX.Element[] }).children;

    expect(getVacancy).toHaveBeenCalledWith(7);
    expect(children.find(child => child.type === VacancyCard)?.props).toEqual({ vacancy: CARD });
  });

  it.each([
    ['the plain list without filters', {}, '/vacancies'],
    ['the list with the filters it came from', { from: 'country=&page=2' }, '/vacancies?country=&page=2'],
    ['only the filters the list knows', { from: 'page=2&next=https://example.com' }, '/vacancies?page=2']
  ])('links back to %s', async (_case, query, expected) => {
    vi.mocked(getVacancy).mockResolvedValue(CARD);

    expect(backLink(await VacancyPage(propsFor('7', query)))).toBe(expected);
  });

  it.each([
    ['a vacancy the API does not have', '7'],
    ['an id that is no number', '7abc'],
    ['an id of zero', '0']
  ])('answers "not found" for %s', async (_case, id) => {
    vi.mocked(getVacancy).mockResolvedValue(undefined);

    await expect(VacancyPage(propsFor(id))).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404');
  });
});
