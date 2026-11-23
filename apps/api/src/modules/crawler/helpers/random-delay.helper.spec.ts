import { describe, expect, it } from 'vitest';

import { randomDelayMs } from './random-delay.helper.js';

describe('randomDelayMs', () => {
  it('stays within both bounds, both included', () => {
    const delays = Array.from({ length: 500 }, () => randomDelayMs(10, 12));

    expect(Math.min(...delays)).toBe(10);
    expect(Math.max(...delays)).toBe(12);
  });

  it('returns the bound itself when both are equal', () => {
    expect(randomDelayMs(500, 500)).toBe(500);
  });

  it('returns an integer', () => {
    expect(Number.isInteger(randomDelayMs(1000, 3000))).toBe(true);
  });
});
