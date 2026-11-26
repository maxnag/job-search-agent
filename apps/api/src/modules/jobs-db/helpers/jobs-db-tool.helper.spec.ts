import { describe, expect, it } from 'vitest';

import { capRows, isoOrNull, limitInput, sinceDaysInput, totalOutput } from './jobs-db-tool.helper.js';

describe('capRows', () => {
  const rows = [1, 2, 3, 4];

  it.each([
    [undefined, 3, [1, 2, 3]],
    [2, 3, [1, 2]],
    [3, 3, [1, 2, 3]],
    [10, 3, [1, 2, 3]],
    [undefined, 10, [1, 2, 3, 4]]
  ])('asked for %s rows with a cap of %s keeps %j', (requested, maxRows, kept) => {
    expect(capRows(rows, requested, maxRows)).toEqual({ rows: kept, total: 4 });
  });

  it('keeps an empty list empty', () => {
    expect(capRows([], 5, 50)).toEqual({ rows: [], total: 0 });
  });

  it('never changes the list it was given', () => {
    capRows(rows, 1, 1);

    expect(rows).toEqual([1, 2, 3, 4]);
  });
});

describe('isoOrNull', () => {
  it('writes a moment as an ISO string', () => {
    expect(isoOrNull(new Date('2026-11-24T08:00:00.000Z'))).toBe('2026-11-24T08:00:00.000Z');
  });

  it('keeps null', () => {
    expect(isoOrNull(null)).toBeNull();
  });
});

describe('limitInput', () => {
  it('takes a positive integer or nothing', () => {
    expect(limitInput().safeParse(1).success).toBe(true);
    expect(limitInput().safeParse(undefined).success).toBe(true);
    expect(limitInput().safeParse(0).success).toBe(false);
    expect(limitInput().safeParse(2.5).success).toBe(false);
  });
});

describe('sinceDaysInput', () => {
  it('takes a positive integer or nothing and names what it counts', () => {
    expect(sinceDaysInput('choices made').safeParse(7).success).toBe(true);
    expect(sinceDaysInput('choices made').safeParse(-1).success).toBe(false);
    expect(sinceDaysInput('choices made').description).toBe('Only choices made within the last N days');
  });
});

describe('totalOutput', () => {
  it('is an integer', () => {
    expect(totalOutput().safeParse(0).success).toBe(true);
    expect(totalOutput().safeParse(1.5).success).toBe(false);
  });
});
