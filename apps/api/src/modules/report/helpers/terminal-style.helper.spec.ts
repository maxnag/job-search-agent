import { styleText } from 'node:util';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SourceStatusEnum, VacancyMatchVerdictEnum, VacancyStageEnum } from '@job-agent/shared';

import { paint, paintRow, paintStage, paintStatus, paintVerdict } from './terminal-style.helper.js';

vi.mock('node:util', async importOriginal => ({
  ...(await importOriginal<typeof import('node:util')>()),
  styleText: vi.fn((format: unknown, text: string) => `[${String(format)}]${text}`)
}));

describe('terminal styles', () => {
  beforeEach(() => {
    vi.mocked(styleText).mockClear();
  });

  it('paint styles a text for the standard output, letting styleText decide whether it is a terminal', () => {
    expect(paint('bold', 'Totals')).toBe('[bold]Totals');
    expect(styleText).toHaveBeenCalledWith('bold', 'Totals');
  });

  it.each([
    [VacancyMatchVerdictEnum.FIT, '[green,bold]fit'],
    [VacancyMatchVerdictEnum.ALMOST, '[yellow]almost'],
    [VacancyMatchVerdictEnum.NO_FIT, '[red]no_fit']
  ])('paintVerdict colours %s', (verdict, painted) => {
    expect(paintVerdict(verdict)).toBe(painted);
  });

  it('paintVerdict colours another text in the colour of the verdict', () => {
    expect(paintVerdict(VacancyMatchVerdictEnum.FIT, 'fit 3')).toBe('[green,bold]fit 3');
  });

  it.each([
    [VacancyStageEnum.LISTED, '[cyan]listed'],
    [VacancyStageEnum.SKIPPED, '[dim]skipped'],
    [VacancyStageEnum.EXTRACTED, '[bold]extracted'],
    [VacancyStageEnum.CLOSED, '[gray]closed']
  ])('paintStage colours %s', (stage, painted) => {
    expect(paintStage(stage)).toBe(painted);
  });

  it('paintRow fades the rows of skipped and closed vacancies only', () => {
    expect(paintRow(VacancyStageEnum.SKIPPED, 'QA')).toBe('[dim]QA');
    expect(paintRow(VacancyStageEnum.CLOSED, 'QA')).toBe('[gray,strikethrough]QA');
    expect(paintRow(VacancyStageEnum.EXTRACTED, 'QA')).toBe('QA');
    expect(paintRow(VacancyStageEnum.LISTED, 'QA')).toBe('QA');
  });

  it.each([
    [SourceStatusEnum.OK, '[green]ok'],
    [SourceStatusEnum.BLOCKED, '[red]blocked'],
    [SourceStatusEnum.BLOCKED_BY_ROBOTS, '[red]blocked_by_robots']
  ])('paintStatus colours %s', (status, painted) => {
    expect(paintStatus(status)).toBe(painted);
  });
});
