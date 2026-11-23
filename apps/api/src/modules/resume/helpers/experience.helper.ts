import type { IMonthRange } from '../interfaces/month-range.interface.js';

/**
 * Months in a year
 *
 * @type {number}
 */
const MONTHS = 12;

/**
 * A date of a resume: `YYYY` or `YYYY-MM`
 *
 * @type {RegExp}
 */
const PERIOD_DATE = /^(\d{4})(?:-(\d{2}))?$/;

/**
 * Year and month of a resume date
 *
 * @param {string} value
 *
 * @returns {{ year: number; month: number | undefined } | undefined}
 */
function parseDate(value: string): { year: number; month: number | undefined } | undefined {
  const match = PERIOD_DATE.exec(value.trim());

  if (!match?.[1]) {
    return undefined;
  }

  return { year: +match[1], month: match[2] ? +match[2] : undefined };
}

/**
 * Month after `now` — the end of a current job
 *
 * @param {Date} now
 *
 * @returns {number}
 */
function monthAfter(now: Date): number {
  return now.getFullYear() * MONTHS + now.getMonth() + 1;
}

/**
 * Period of a job: a year-only start is its January, a year-only end its December, a missing end is today;
 * nothing ends after today
 *
 * @param {string | null} start
 * @param {string | null} end
 * @param {Date} now
 *
 * @returns {IMonthRange | undefined} Undefined when the start is missing or unreadable
 */
export function toMonthRange(start: string | null, end: string | null, now: Date): IMonthRange | undefined {
  const from = start ? parseDate(start) : undefined;

  if (!from) {
    return undefined;
  }

  const to = end ? parseDate(end) : undefined;
  const limit = monthAfter(now);
  const startMonth = from.year * MONTHS + (from.month ?? 1) - 1;
  let endMonth = limit;

  if (to) {
    endMonth = to.month === undefined ? (to.year + 1) * MONTHS : to.year * MONTHS + to.month;
  }

  const range = { start: startMonth, end: Math.min(endMonth, limit) };

  return range.end > range.start ? range : undefined;
}

/**
 * Years covered by periods, overlaps counted once, to one decimal
 *
 * @param {readonly IMonthRange[]} ranges
 *
 * @returns {number | null} Null when there are no periods
 */
export function countYears(ranges: readonly IMonthRange[]): number | null {
  if (ranges.length === 0) {
    return null;
  }

  const sorted = [...ranges].sort((first, second) => first.start - second.start);
  let months = 0;
  let cursor = Number.NEGATIVE_INFINITY;

  for (const range of sorted) {
    const from = Math.max(range.start, cursor);

    if (range.end > from) {
      months += range.end - from;
      cursor = range.end;
    }
  }

  return Math.round((months / MONTHS) * 10) / 10;
}
