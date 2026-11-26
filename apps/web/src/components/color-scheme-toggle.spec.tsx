import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../test/render';
import { ColorSchemeToggle } from './color-scheme-toggle';

describe('ColorSchemeToggle', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('offers the light, the dark and the system scheme, named for a screen reader', () => {
    renderWithProviders(<ColorSchemeToggle />);

    expect(screen.getByRole('radiogroup', { name: 'Theme' })).toBeDefined();
    expect(screen.getAllByRole('radio').map(radio => (radio as HTMLInputElement).value)).toEqual(['light', 'dark', 'auto']);
    expect(screen.getByRole('radio', { name: 'System' })).toBeDefined();
  });

  it('switches the page to the chosen scheme and remembers it', async () => {
    renderWithProviders(<ColorSchemeToggle />);
    await userEvent.click(screen.getByRole('radio', { name: 'Dark' }));

    expect(document.documentElement.getAttribute('data-mantine-color-scheme')).toBe('dark');
    expect(localStorage.getItem('mantine-color-scheme-value')).toBe('dark');
    expect(screen.getByRole<HTMLInputElement>('radio', { name: 'Dark' }).checked).toBe(true);
  });
});
