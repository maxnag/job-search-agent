import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/render';
import ErrorPage from './error';

describe('ErrorPage', () => {
  it('explains the failure and tries the page again on request', async () => {
    const reset = vi.fn();

    renderWithProviders(<ErrorPage error={new Error('The API is not reachable')} reset={reset} />);

    expect(screen.getByRole('heading', { level: 2, name: 'Something went wrong' })).toBeDefined();
    expect(screen.queryByText('The API is not reachable')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(reset).toHaveBeenCalledOnce();
  });
});
