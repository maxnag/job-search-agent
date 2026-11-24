import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SourceFetchModeEnum, SourceStatusEnum, VacancyMatchVerdictEnum, VacancyStageEnum, WorkModeEnum } from '@job-agent/shared';

import { MatchRuleEnum } from '../../matching/enums/match-rule.enum.js';
import type { IReportSource, IReportVacancy, IVacancyReportData } from '../interfaces/vacancy-report.interface.js';
import { formatVacancyReport } from './vacancy-report.helper.js';

vi.mock('node:util', async importOriginal => ({
  ...(await importOriginal<typeof import('node:util')>()),
  styleText: (_format: unknown, text: string) => text
}));

const SOURCE: IReportSource = {
  sourceId: 1,
  name: 'Northwind',
  url: 'https://careers.example.com/jobs',
  fetchMode: SourceFetchModeEnum.HTML,
  isActive: true,
  status: SourceStatusEnum.OK,
  lastScanAt: new Date(2026, 10, 23, 15, 33),
  lastError: null
};

/**
 * A vacancy of the source
 *
 * @param {Partial<IReportVacancy>} changes
 *
 * @returns {IReportVacancy}
 */
function vacancy(changes: Partial<IReportVacancy> = {}): IReportVacancy {
  return {
    vacancyId: 7,
    sourceId: 1,
    title: 'Backend Developer',
    city: 'Haifa',
    country: 'IL',
    workMode: WorkModeEnum.HYBRID,
    stage: VacancyStageEnum.EXTRACTED,
    skipReason: null,
    ...changes
  };
}

/**
 * Report data of the source with the given vacancies
 *
 * @param {IReportVacancy[]} vacancies
 * @param {Partial<IReportSource>} source
 *
 * @returns {IVacancyReportData}
 */
function data(vacancies: IReportVacancy[], source: Partial<IReportSource> = {}): IVacancyReportData {
  return {
    sources: [{ ...SOURCE, ...source }],
    vacancies,
    matches: [
      {
        vacancyId: 7,
        profileName: 'developer',
        verdict: VacancyMatchVerdictEnum.FIT,
        reasons: [{ rule: MatchRuleEnum.LANGUAGES, effect: VacancyMatchVerdictEnum.FIT, message: 'matches TypeScript' }]
      },
      { vacancyId: 99, profileName: 'developer', verdict: VacancyMatchVerdictEnum.NO_FIT, reasons: [] }
    ]
  };
}

const HINT = "Hint: no positions found in html mode — if the page draws its list with JavaScript, set source_fetch_mode = 'rendered'";

describe('formatVacancyReport', () => {
  let columns: number | undefined;

  beforeEach(() => {
    columns = process.stdout.columns;
    process.stdout.columns = 120;
  });

  afterEach(() => {
    process.stdout.columns = columns as number;
  });

  it('asks for sources when there are none', () => {
    expect(formatVacancyReport({ sources: [], vacancies: [], matches: [] })).toBe('No sources. Add career pages to the sources table.\n');
  });

  it('heads each source with its state, last scan and URL', () => {
    const lines = formatVacancyReport(data([vacancy()])).split('\n');

    expect(lines[0]).toBe('Northwind  #1  html · ok · active  last scan 2026-11-23 15:33');
    expect(lines[1]).toBe('https://careers.example.com/jobs');
  });

  it('says a switched-off source was never scanned and shows its last error', () => {
    const report = formatVacancyReport(data([], { isActive: false, lastScanAt: null, lastError: 'FETCH_FAILED: timeout' }));

    expect(report).toContain('html · ok · switched off  never scanned');
    expect(report).toContain('Error: FETCH_FAILED: timeout');
    expect(report).toContain('No positions');
  });

  it('shows each vacancy with its stage, position and verdicts, a skipped one with its reason', () => {
    const report = formatVacancyReport(
      data([
        vacancy(),
        vacancy({ vacancyId: 8, title: 'QA Engineer', stage: VacancyStageEnum.SKIPPED, skipReason: 'role qa is not searched' })
      ])
    );

    expect(report).toMatch(/│\s+7 │ extracted │ Backend Developer · Haifa, IL · hybrid\s+│ developer: fit — matches TypeScript\s+│/);
    expect(report).toMatch(/│\s+8 │ skipped\s+│ QA Engineer · Haifa, IL · hybrid\s+│ role qa is not searched\s+│/);
  });

  it('counts the positions by stage and the verdicts of the reported vacancies only', () => {
    const report = formatVacancyReport(data([vacancy(), vacancy({ vacancyId: 8, stage: VacancyStageEnum.CLOSED })]));

    expect(report.trimEnd().split('\n').at(-1)).toBe(
      'Totals  2 positions — listed 0 · skipped 0 · extracted 1 · closed 1   verdicts: fit 1 · almost 0 · no_fit 0'
    );
  });

  it('hints at the rendered mode for a scanned html source in order without open positions', () => {
    expect(formatVacancyReport(data([vacancy({ stage: VacancyStageEnum.CLOSED })]))).toContain(HINT);
  });

  it.each([
    ['an open position', { stage: VacancyStageEnum.LISTED }, {}],
    ['the rendered mode', { stage: VacancyStageEnum.CLOSED }, { fetchMode: SourceFetchModeEnum.RENDERED }],
    ['a blocked source', { stage: VacancyStageEnum.CLOSED }, { status: SourceStatusEnum.BLOCKED }],
    ['a source never scanned', { stage: VacancyStageEnum.CLOSED }, { lastScanAt: null }]
  ])('gives no hint for %s', (_case, vacancyChanges: Partial<IReportVacancy>, sourceChanges: Partial<IReportSource>) => {
    expect(formatVacancyReport(data([vacancy(vacancyChanges)], sourceChanges))).not.toContain('Hint:');
  });

  it('wraps a long title inside its cell instead of widening the table', () => {
    const report = formatVacancyReport(data([vacancy({ title: 'Principal Software Engineer '.repeat(6) })]));
    const widths = report
      .split('\n')
      .filter(line => line.startsWith('│'))
      .map(line => line.length);

    expect(new Set(widths).size).toBe(1);
    expect(widths[0]).toBeLessThanOrEqual(120);
  });

  it('names the hidden closed positions when no filter is given', () => {
    expect(
      formatVacancyReport(data([vacancy()]))
        .trimEnd()
        .split('\n')
        .at(-2)
    ).toBe('Filter: closed hidden (--closed shows them)');
  });

  it('names every filter applied above the totals', () => {
    const filter = {
      sourceIds: [1, 3],
      stages: [VacancyStageEnum.EXTRACTED, VacancyStageEnum.CLOSED],
      verdicts: [VacancyMatchVerdictEnum.FIT],
      reason: 'hebrew',
      country: 'il',
      workMode: WorkModeEnum.HYBRID,
      title: 'backend',
      sinceDays: 7,
      limit: 20
    };

    expect(
      formatVacancyReport(data([vacancy()]), filter)
        .trimEnd()
        .split('\n')
        .at(-2)
    ).toBe(
      'Filter: source #1, #3 · stage extracted, closed · verdict fit · reason contains "hebrew" · country IL · work mode hybrid · ' +
        'title contains "backend" · first seen in the last 7 days · newest 20 per source · closed shown'
    );
  });

  it('shows the counts of each source instead of its table in a summary', () => {
    const lines = formatVacancyReport(data([vacancy(), vacancy({ vacancyId: 8, stage: VacancyStageEnum.SKIPPED })]), {}, true).split('\n');

    expect(lines.some(line => line.includes('│'))).toBe(false);
    expect(lines[2]).toBe('2 positions — listed 0 · skipped 1 · extracted 1 · closed 0   verdicts: fit 1 · almost 0 · no_fit 0');
  });

  it('hides the sources a filter on positions left empty, and keeps them for a filter on sources only', () => {
    const report = data([vacancy()]);
    const empty = { ...report, sources: [...report.sources, { ...SOURCE, sourceId: 2, name: 'Contoso' }] };

    expect(formatVacancyReport(empty, { stages: [VacancyStageEnum.EXTRACTED] })).not.toContain('Contoso');
    expect(formatVacancyReport(empty, { sourceIds: [1, 2] })).toContain('Contoso');
  });

  it('says nothing matched when a filter on positions leaves every source empty, and gives no hint', () => {
    const report = formatVacancyReport(data([]), { title: 'designer' });

    expect(report).toContain('No position matches the filter.');
    expect(report).not.toContain('Northwind');
    expect(formatVacancyReport(data([vacancy({ stage: VacancyStageEnum.CLOSED })]), { closed: true, title: 'backend' })).not.toContain(
      'Hint:'
    );
  });

  it('keeps a table readable on a narrow terminal and in a pipe', () => {
    process.stdout.columns = 40;
    expect(formatVacancyReport(data([vacancy()])).split('\n')[2]?.length).toBe(80);

    process.stdout.columns = undefined as unknown as number;
    expect(formatVacancyReport(data([vacancy()])).split('\n')[2]?.length).toBe(140);
  });
});
