import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/render';
import NotFoundPage from './not-found';

vi.mock('next-intl/server', () => import('../../../test/next-intl-server.mock'));

describe('NotFoundPage', () => {
  it('says the page does not exist and leads to the vacancies', async () => {
    renderWithProviders(await NotFoundPage());

    expect(screen.getByRole('heading', { level: 2, name: 'Page not found' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'To the vacancies' }).getAttribute('href')).toBe('/en/vacancies');
  });
});
