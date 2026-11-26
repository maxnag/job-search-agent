import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../test/render';
import { ButtonLink } from './button-link';

describe('ButtonLink', () => {
  it('is a link under the language of the page that looks like a button', () => {
    renderWithProviders(
      <ButtonLink href="/vacancies" variant="light">
        To the vacancies
      </ButtonLink>,
      'uk'
    );

    const link = screen.getByRole('link', { name: 'To the vacancies' });

    expect(link.getAttribute('href')).toBe('/uk/vacancies');
    expect(link.className).toContain('mantine-Button-root');
    expect(link.getAttribute('data-variant')).toBe('light');
  });
});
