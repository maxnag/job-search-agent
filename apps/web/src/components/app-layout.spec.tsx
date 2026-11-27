import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../test/render';
import { AppLayout } from './app-layout';

/**
 * Render the frame with a stand-in status and page
 *
 * @returns {void}
 */
function renderLayout(): void {
  renderWithProviders(
    <AppLayout apiStatus={<span>status of the API</span>} phone={false}>
      <p>content of the page</p>
    </AppLayout>
  );
}

describe('AppLayout', () => {
  it('shows the title, the API status, the switches, the menu and the page', () => {
    renderLayout();

    expect(screen.getByRole('heading', { level: 4, name: 'Job Search Agent' })).toBeDefined();
    expect(screen.getByText('status of the API')).toBeDefined();
    expect(screen.getByRole('radiogroup', { name: 'Language' })).toBeDefined();
    expect(screen.getByRole('radiogroup', { name: 'Theme' })).toBeDefined();
    expect(screen.getAllByRole('link').map(link => link.textContent)).toEqual(['Vacancies', 'Companies', 'Sources']);
    expect(screen.getByText('content of the page')).toBeDefined();
  });

  it('opens the menu with the burger on a narrow screen and closes it again', async () => {
    renderLayout();

    const burger = screen.getByLabelText('Toggle the menu');

    expect(burger.querySelector('[data-opened]')).toBeNull();

    await userEvent.click(burger);
    expect(burger.querySelector('[data-opened]')).not.toBeNull();

    await userEvent.click(burger);
    expect(burger.querySelector('[data-opened]')).toBeNull();
  });

  it('closes the mobile menu when a section is chosen', async () => {
    renderLayout();

    const burger = screen.getByLabelText('Toggle the menu');

    await userEvent.click(burger);
    window.addEventListener('click', event => event.preventDefault(), { once: true });
    await userEvent.click(screen.getByRole('link', { name: 'Companies' }));

    expect(burger.querySelector('[data-opened]')).toBeNull();
  });
});
