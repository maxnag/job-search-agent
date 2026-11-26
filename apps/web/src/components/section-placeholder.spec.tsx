import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../test/render';
import { SectionPlaceholder } from './section-placeholder';

vi.mock('next-intl/server', () => import('../../test/next-intl-server.mock'));

describe('SectionPlaceholder', () => {
  it.each([
    ['vacancies', 'Vacancies', 'The list of vacancies with filters comes in phase 1.'],
    ['companies', 'Companies', 'Companies come in phase 2.'],
    ['sources', 'Sources', 'Sources come in phase 2.']
  ] as const)('shows the title and the note of %s', async (section, title, note) => {
    renderWithProviders(await SectionPlaceholder({ section }));

    expect(screen.getByRole('heading', { level: 2, name: title })).toBeDefined();
    expect(screen.getByText(note)).toBeDefined();
  });
});
