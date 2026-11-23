import { describe, expect, it } from 'vitest';

import { countYears, toMonthRange } from './experience.helper.js';

const NOW = new Date(2026, 10, 15);
const month = (year: number, monthOfYear: number): number => year * 12 + monthOfYear - 1;

describe('toMonthRange', () => {
  it('runs a year without a month from January to December inclusive', () => {
    expect(toMonthRange('2019', '2024', NOW)).toEqual({ start: month(2019, 1), end: month(2025, 1) });
  });

  it('uses the months when the resume gives them', () => {
    expect(toMonthRange('2019-03', '2020-02', NOW)).toEqual({ start: month(2019, 3), end: month(2020, 3) });
  });

  it('runs a current job until the month of today', () => {
    expect(toMonthRange('2025', null, NOW)).toEqual({ start: month(2025, 1), end: month(2026, 12) });
  });

  it('never ends after today', () => {
    expect(toMonthRange('2025', '2027', NOW)?.end).toBe(month(2026, 12));
  });

  it.each([
    [null, '2020'],
    ['present', '2020'],
    ['20', null]
  ])('gives no period for the start %s', (start, end) => {
    expect(toMonthRange(start, end, NOW)).toBeUndefined();
  });

  it('gives no period when the end is before the start', () => {
    expect(toMonthRange('2020-06', '2020-01', NOW)).toBeUndefined();
  });
});

describe('countYears', () => {
  it('returns null without periods', () => {
    expect(countYears([])).toBeNull();
  });

  it('counts overlapping periods once', () => {
    const oracle = { start: month(2014, 1), end: month(2019, 1) };
    const smsedge = { start: month(2018, 1), end: month(2020, 1) };

    expect(countYears([oracle, smsedge])).toBe(6);
  });

  it('adds periods with a gap between them', () => {
    expect(
      countYears([
        { start: month(2010, 1), end: month(2011, 1) },
        { start: month(2015, 1), end: month(2016, 1) }
      ])
    ).toBe(2);
  });

  it('rounds to one decimal', () => {
    expect(countYears([{ start: month(2025, 1), end: month(2026, 12) }])).toBeCloseTo(1.9, 5);
  });

  it('ignores the order of the periods', () => {
    const late = { start: month(2020, 1), end: month(2021, 1) };
    const early = { start: month(2019, 1), end: month(2020, 7) };

    expect(countYears([late, early])).toBe(2);
  });
});
