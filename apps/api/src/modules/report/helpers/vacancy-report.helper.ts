import Table from 'cli-table3';

import { SourceFetchModeEnum, SourceStatusEnum, VacancyMatchVerdictEnum, VacancyStageEnum } from '@job-agent/shared';

import type { IReportMatch, IReportSource, IReportVacancy, IVacancyReportData } from '../interfaces/vacancy-report.interface.js';
import { paint, paintRow, paintStage, paintStatus, paintVerdict } from './terminal-style.helper.js';

/**
 * Width of the report when the output is not a terminal
 *
 * @type {number}
 */
const DEFAULT_WIDTH = 140;

/**
 * Narrowest table the columns still fit in
 *
 * @type {number}
 */
const MIN_WIDTH = 80;

/**
 * Width of the stage column, padding included
 *
 * @type {number}
 */
const STAGE_WIDTH = 11;

/**
 * Padding of a cell on both sides
 *
 * @type {number}
 */
const CELL_PADDING = 2;

/**
 * Vertical borders of a four-column table
 *
 * @type {number}
 */
const BORDERS = 5;

/**
 * Share of the free width the position column takes, the rest goes to the reasons
 *
 * @type {number}
 */
const POSITION_SHARE = 0.45;

/**
 * Separator between the parts of a line
 *
 * @type {string}
 */
const DOT = ' · ';

/**
 * Date and time in the local time zone of the process (`TZ`)
 *
 * @type {Intl.DateTimeFormat}
 */
const DATE_TIME = new Intl.DateTimeFormat('sv-SE', { dateStyle: 'short', timeStyle: 'short' });

/**
 * Title, place and work mode of a vacancy
 *
 * @param {IReportVacancy} vacancy
 *
 * @returns {string}
 */
function position(vacancy: IReportVacancy): string {
  const place = [vacancy.city, vacancy.country].filter(Boolean).join(', ');

  return [vacancy.title, place, vacancy.workMode ?? ''].filter(Boolean).join(DOT);
}

/**
 * Verdicts of a vacancy, one line per profile, with the findings that lower or mark them
 *
 * @param {readonly IReportMatch[]} matches
 *
 * @returns {string}
 */
function verdicts(matches: readonly IReportMatch[]): string {
  return matches
    .map(match => {
      const findings = match.reasons.map(reason => reason.message).join('; ');
      const verdict = `${match.profileName}: ${paintVerdict(match.verdict)}`;

      return findings ? `${verdict} — ${paint('dim', findings)}` : verdict;
    })
    .join('\n');
}

/**
 * The cells of one vacancy: why it was dropped, or its verdicts
 *
 * @param {IReportVacancy} vacancy
 * @param {readonly IReportMatch[]} matches
 *
 * @returns {string[]}
 */
function vacancyRow(vacancy: IReportVacancy, matches: readonly IReportMatch[]): string[] {
  const why = vacancy.skipReason ?? verdicts(matches);

  return [
    paintRow(vacancy.stage, String(vacancy.vacancyId)),
    paintStage(vacancy.stage),
    paintRow(vacancy.stage, position(vacancy)),
    vacancy.skipReason ? paintRow(vacancy.stage, why) : why
  ];
}

/**
 * Widths of the columns for the width of the terminal: the id and the stage fixed, the rest split between the position
 * and the reasons
 *
 * @param {readonly IReportVacancy[]} vacancies
 *
 * @returns {number[]}
 */
function columnWidths(vacancies: readonly IReportVacancy[]): number[] {
  const total = Math.max(process.stdout.columns ?? DEFAULT_WIDTH, MIN_WIDTH);
  const idWidth = Math.max(...vacancies.map(vacancy => String(vacancy.vacancyId).length), 1) + CELL_PADDING;
  const free = total - idWidth - STAGE_WIDTH - BORDERS;
  const positionWidth = Math.floor(free * POSITION_SHARE);

  return [idWidth, STAGE_WIDTH, positionWidth, free - positionWidth];
}

/**
 * The vacancies of a source as a table
 *
 * @param {readonly IReportVacancy[]} vacancies
 * @param {readonly IReportMatch[]} matches
 *
 * @returns {string}
 */
function vacancyTable(vacancies: readonly IReportVacancy[], matches: readonly IReportMatch[]): string {
  const table = new Table({
    head: ['#', 'Stage', 'Position', 'Why'].map(title => paint('bold', title)),
    colWidths: columnWidths(vacancies),
    colAligns: ['right', 'left', 'left', 'left'],
    wordWrap: true,
    style: { head: [], border: [], compact: true }
  });

  for (const vacancy of vacancies) {
    table.push(
      vacancyRow(
        vacancy,
        matches.filter(match => match.vacancyId === vacancy.vacancyId)
      )
    );
  }

  return table.toString();
}

/**
 * The header of a source and a hint when a scanned `html` page the crawler did not stop yielded no open position — its
 * list may be drawn by JavaScript
 *
 * @param {IReportSource} source
 * @param {readonly IReportVacancy[]} vacancies
 *
 * @returns {string[]}
 */
function sourceLines(source: IReportSource, vacancies: readonly IReportVacancy[]): string[] {
  const switched = source.isActive ? 'active' : paint('yellow', 'switched off');
  const state = [source.fetchMode, paintStatus(source.status), switched].join(DOT);
  const scanned = source.lastScanAt ? `last scan ${DATE_TIME.format(source.lastScanAt)}` : 'never scanned';
  const open = vacancies.filter(vacancy => vacancy.stage !== VacancyStageEnum.CLOSED).length;
  const lines = [
    [paint('bold', source.name), paint('dim', '#' + source.sourceId), state, paint('dim', scanned)].join('  '),
    paint(['cyan', 'underline'], source.url)
  ];

  if (source.lastError) {
    lines.push(paint('red', `Error: ${source.lastError}`));
  }

  if (source.fetchMode === SourceFetchModeEnum.HTML && source.status === SourceStatusEnum.OK && source.lastScanAt && open === 0) {
    lines.push(
      paint(
        'yellow',
        `Hint: no positions found in html mode — if the page draws its list with JavaScript, set source_fetch_mode = 'rendered'`
      )
    );
  }

  return lines;
}

/**
 * Totals by stage and, for the extracted vacancies, by verdict
 *
 * @param {IVacancyReportData} data
 *
 * @returns {string}
 */
function totals(data: IVacancyReportData): string {
  const byStage = Object.values(VacancyStageEnum).map(
    stage => `${paintStage(stage)} ${data.vacancies.filter(vacancy => vacancy.stage === stage).length}`
  );
  const vacancyIds = new Set(data.vacancies.map(vacancy => vacancy.vacancyId));
  const matches = data.matches.filter(match => vacancyIds.has(match.vacancyId));
  const byVerdict = Object.values(VacancyMatchVerdictEnum).map(verdict =>
    paintVerdict(verdict, `${verdict} ${matches.filter(match => match.verdict === verdict).length}`)
  );
  const positions = `${data.vacancies.length} positions — ${byStage.join(DOT)}`;

  return `${paint('bold', 'Totals')}  ${positions}   verdicts: ${byVerdict.join(DOT)}`;
}

/**
 * Every position of every source with its stage and why: the skip reason of the code filter, or the verdict per
 * profile with its findings — for the owner to check the filters drop nothing they need
 *
 * @param {IVacancyReportData} data
 *
 * @returns {string}
 */
export function formatVacancyReport(data: IVacancyReportData): string {
  if (data.sources.length === 0) {
    return 'No sources. Add career pages to the sources table.\n';
  }

  const lines: string[] = [];

  for (const source of data.sources) {
    const vacancies = data.vacancies.filter(vacancy => vacancy.sourceId === source.sourceId);

    lines.push(...sourceLines(source, vacancies));
    lines.push(vacancies.length > 0 ? vacancyTable(vacancies, data.matches) : paint('dim', 'No positions'));
    lines.push('');
  }

  lines.push(totals(data));

  return `${lines.join('\n')}\n`;
}
