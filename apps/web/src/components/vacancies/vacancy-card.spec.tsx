import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { HebrewRequirementEnum, VacancyActionKindEnum, VacancyMatchVerdictEnum, VacancyStageEnum, WorkModeEnum } from '@job-agent/shared';

import type { VacancyCardType } from '@/server/schemas/vacancy-card.schema';

import { renderWithProviders } from '../../../test/render';
import { VacancyCard } from './vacancy-card';

vi.mock('next-intl/server', () => import('../../../test/next-intl-server.mock'));
vi.mock('@/app/[locale]/vacancies/actions', () => ({ recordAction: vi.fn() }));

const CARD: VacancyCardType = {
  vacancyId: 7,
  title: 'Backend Developer',
  company: 'Northwind',
  city: 'Haifa',
  country: 'IL',
  workMode: WorkModeEnum.HYBRID,
  level: null,
  stage: VacancyStageEnum.EXTRACTED,
  skipReason: null,
  source: 'Northwind',
  url: 'https://careers.example.com/jobs/7',
  textURL: 'https://boards.example.com/northwind/7',
  firstSeenAt: '2026-11-20T18:43:00.000Z',
  lastSeenAt: '2026-11-21T09:05:00.000Z',
  closedAt: null,
  extraction: {
    summary: 'Builds the services of a fictional shop.',
    programmingLanguages: [
      { name: 'TypeScript', required: true },
      { name: 'Go', required: false }
    ],
    frameworks: ['NestJS'],
    yearsRequired: 5,
    hebrew: HebrewRequirementEnum.NONE
  },
  matches: [
    {
      profile: 'developer',
      verdict: VacancyMatchVerdictEnum.ALMOST,
      findings: [
        { rule: 'languages', effect: VacancyMatchVerdictEnum.FIT, message: 'TypeScript matches' },
        { rule: 'experience', effect: VacancyMatchVerdictEnum.ALMOST, message: 'asks for 5 years' }
      ],
      notifiedAt: null
    }
  ],
  actions: [
    { kind: VacancyActionKindEnum.SKIPPED, at: '2026-11-20T19:00:00.000Z' },
    { kind: VacancyActionKindEnum.INTERESTED, at: '2026-11-21T10:00:00.000Z' }
  ]
};

describe('VacancyCard', () => {
  it('shows where and what, the links to the original and the board, and the dates in 24 hours', async () => {
    renderWithProviders(await VacancyCard({ vacancy: CARD }));

    expect(screen.getByRole('heading', { level: 2, name: 'Backend Developer' })).toBeDefined();
    expect(screen.getByText('· IL, Haifa')).toBeDefined();
    expect(screen.getByRole('link', { name: /Open the original/ }).getAttribute('href')).toBe(CARD.url);
    expect(screen.getByRole('link', { name: /Text on the company board/ }).getAttribute('rel')).toBe('noopener noreferrer');
    expect(screen.getByText(/Found: Nov 20, 2026, 18:43/)).toBeDefined();
  });

  it('shows the extraction and only the findings that lowered the verdict', async () => {
    renderWithProviders(await VacancyCard({ vacancy: CARD }));

    expect(screen.getByText('Builds the services of a fictional shop.')).toBeDefined();
    expect(screen.getByText('TypeScript (required), Go')).toBeDefined();
    expect(screen.getByText('asks for 5 years')).toBeDefined();
    expect(screen.queryByText('TypeScript matches')).toBeNull();
  });

  it('lists the choices oldest first and marks the latest on the buttons', async () => {
    renderWithProviders(await VacancyCard({ vacancy: CARD }));

    expect(
      screen
        .getAllByRole('listitem')
        .map(item => item.textContent)
        .filter(text => /—/.test(text ?? ''))
    ).toEqual(['Skipped — Nov 20, 2026, 19:00', 'Interested — Nov 21, 2026, 10:00']);
    expect(screen.getByRole('button', { name: 'Interested' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('says what is missing before the extraction, without verdicts and choices', async () => {
    renderWithProviders(
      await VacancyCard({ vacancy: { ...CARD, textURL: null, extraction: null, matches: [], actions: [], skipReason: 'asks for Hebrew' } })
    );

    expect(screen.getByText('Skipped by the filter: asks for Hebrew')).toBeDefined();
    expect(screen.getByText('Not extracted yet.')).toBeDefined();
    expect(screen.getByText('No verdicts against the current resumes.')).toBeDefined();
    expect(screen.getByText('No choice made yet.')).toBeDefined();
    expect(screen.queryByRole('link', { name: /Text on the company board/ })).toBeNull();
  });
});
