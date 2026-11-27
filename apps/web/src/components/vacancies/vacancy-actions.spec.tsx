import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { VacancyActionKindEnum } from '@job-agent/shared';

import { recordAction } from '@/app/[locale]/vacancies/actions';

import { renderWithProviders } from '../../../test/render';
import { VacancyActions } from './vacancy-actions';

vi.mock('@/app/[locale]/vacancies/actions', () => ({ recordAction: vi.fn() }));

/**
 * Which buttons say they are the chosen one
 *
 * @returns {string[]}
 */
function pressed(): string[] {
  return screen
    .getAllByRole('button')
    .filter(button => button.getAttribute('aria-pressed') === 'true')
    .map(button => button.textContent ?? '');
}

describe('VacancyActions', () => {
  afterEach(() => {
    vi.mocked(recordAction).mockReset();
  });

  it('shows the three choices and marks the latest one with a border', () => {
    renderWithProviders(<VacancyActions vacancyId={7} current={VacancyActionKindEnum.SKIPPED} />);

    expect(screen.getAllByRole('button').map(button => button.textContent)).toEqual(['Interested', 'Skip', 'Applied']);
    expect(pressed()).toEqual(['Skip']);
    expect(screen.getByRole('button', { name: 'Skip' }).style.border).toContain('var(--mantine-color-red-filled)');
    expect(screen.getByRole('button', { name: 'Applied' }).style.border).toContain('transparent');
  });

  it('marks nothing before the first choice', () => {
    renderWithProviders(<VacancyActions vacancyId={7} current={null} />);

    expect(pressed()).toEqual([]);
  });

  it('sends the press with the vacancy and the choice', async () => {
    vi.mocked(recordAction).mockResolvedValue({ kind: VacancyActionKindEnum.APPLIED, failed: false });
    renderWithProviders(<VacancyActions vacancyId={7} current={null} />);

    await userEvent.click(screen.getByRole('button', { name: 'Applied' }));

    await waitFor(() => {
      expect(recordAction).toHaveBeenCalledTimes(1);
    });

    const form = vi.mocked(recordAction).mock.calls[0]?.[1];

    expect(form?.get('vacancyId')).toBe('7');
    expect(form?.get('kind')).toBe('applied');
  });

  it('says the choice was not saved and leaves the mark where it was when the API fails', async () => {
    vi.mocked(recordAction).mockResolvedValue({ kind: VacancyActionKindEnum.SKIPPED, failed: true });
    renderWithProviders(<VacancyActions vacancyId={7} current={VacancyActionKindEnum.SKIPPED} />);

    await userEvent.click(screen.getByRole('button', { name: 'Applied' }));

    expect(await screen.findByText('The choice was not saved — the API did not answer. Try again.')).toBeDefined();
    expect(pressed()).toEqual(['Skip']);
  });
});
