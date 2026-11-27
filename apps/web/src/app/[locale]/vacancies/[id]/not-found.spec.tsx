import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../../../test/render';
import VacancyNotFound from './not-found';

vi.mock('next-intl/server', () => import('../../../../../test/next-intl-server.mock'));

describe('VacancyNotFound', () => {
  it('says there is no such vacancy and links back to the list', async () => {
    renderWithProviders(await VacancyNotFound());

    expect(screen.getByRole('heading', { level: 2, name: 'Vacancy not found' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Back to the list' }).getAttribute('href')).toBe('/en/vacancies');
  });
});
