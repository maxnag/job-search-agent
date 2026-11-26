import { describe, expect, it, vi } from 'vitest';

import { SectionPlaceholder } from '@/components/section-placeholder';

import VacanciesPage, { generateMetadata } from './page';

vi.mock('next-intl/server', () => import('../../../../test/next-intl-server.mock'));

describe('VacanciesPage', () => {
  it('names the tab after the section', async () => {
    await expect(generateMetadata()).resolves.toEqual({ title: 'Vacancies' });
  });

  it('shows the placeholder of the section', () => {
    const page = VacanciesPage();

    expect(page.type).toBe(SectionPlaceholder);
    expect(page.props).toEqual({ section: 'vacancies' });
  });
});
