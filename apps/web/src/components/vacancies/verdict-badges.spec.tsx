import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { VacancyMatchVerdictEnum } from '@job-agent/shared';

import { renderWithProviders } from '../../../test/render';
import { VerdictBadges } from './verdict-badges';

describe('VerdictBadges', () => {
  it('shows a badge per profile with its verdict', () => {
    renderWithProviders(
      <VerdictBadges
        verdicts={[
          { profile: 'developer', verdict: VacancyMatchVerdictEnum.FIT, findings: [] },
          { profile: 'lead', verdict: VacancyMatchVerdictEnum.NO_FIT, findings: ['asks for Hebrew'] }
        ]}
      />
    );

    expect(screen.getByText('developer: Fit')).toBeDefined();
    expect(screen.getByText('lead: No fit')).toBeDefined();
  });

  it('tells on hover what lowered a verdict', async () => {
    renderWithProviders(
      <VerdictBadges
        verdicts={[{ profile: 'lead', verdict: VacancyMatchVerdictEnum.ALMOST, findings: ['asks for 7 years', 'names no language'] }]}
      />
    );

    await userEvent.hover(screen.getByText('lead: Almost'));

    expect(await screen.findByText('asks for 7 years')).toBeDefined();
    expect(screen.getByText('names no language')).toBeDefined();
  });

  it('tells on hover that a clean fit passed every rule', async () => {
    renderWithProviders(<VerdictBadges verdicts={[{ profile: 'developer', verdict: VacancyMatchVerdictEnum.FIT, findings: [] }]} />);

    await userEvent.hover(screen.getByText('developer: Fit'));

    expect(await screen.findByText('Every rule passed.')).toBeDefined();
  });
});
