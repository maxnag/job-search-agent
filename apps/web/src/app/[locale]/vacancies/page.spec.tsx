import { describe, expect, it, vi } from 'vitest';

import { generateMetadata } from './page';

vi.mock('next-intl/server', () => import('../../../../test/next-intl-server.mock'));

describe('VacanciesPage', () => {
  it('names the tab after the section', async () => {
    await expect(generateMetadata()).resolves.toEqual({ title: 'Vacancies' });
  });
});
