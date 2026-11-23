import { randomInt } from 'node:crypto';

/**
 * A random pause between two bounds, both included — the gaps between requests never form a pattern
 *
 * @param {number} minMs
 * @param {number} maxMs
 *
 * @returns {number}
 */
export function randomDelayMs(minMs: number, maxMs: number): number {
  return randomInt(minMs, maxMs + 1);
}
