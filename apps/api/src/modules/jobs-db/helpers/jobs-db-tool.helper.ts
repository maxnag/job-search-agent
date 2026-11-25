import { z } from 'zod';

/**
 * The first rows of a list, never more than the server allows whatever the client asked for, with the total
 *
 * @param {readonly T[]} rows
 * @param {number | undefined} requested
 * @param {number} maxRows
 *
 * @template T
 *
 * @returns {{ rows: T[], total: number }}
 */
export function capRows<T>(rows: readonly T[], requested: number | undefined, maxRows: number): { rows: T[]; total: number } {
  return { rows: rows.slice(0, Math.min(requested ?? maxRows, maxRows)), total: rows.length };
}

/**
 * A moment as an ISO string, `null` kept
 *
 * @param {Date | null} date
 *
 * @returns {string | null}
 */
export function isoOrNull(date: Date | null): string | null {
  return date === null ? null : date.toISOString();
}

/**
 * Input of a list tool: how many rows the client wants
 *
 * @returns {z.ZodOptional<z.ZodNumber>}
 */
export function limitInput() {
  return z.number().int().positive().optional().describe('At most this many rows; the server caps it anyway');
}

/**
 * Input of a tool over a period: the last N days
 *
 * @param {string} what
 *
 * @returns {z.ZodOptional<z.ZodNumber>}
 */
export function sinceDaysInput(what: string) {
  return z.number().int().positive().optional().describe(`Only ${what} within the last N days`);
}

/**
 * Output of a list tool: how many rows there were in all
 *
 * @returns {z.ZodNumber}
 */
export function totalOutput() {
  return z.number().int().describe('Rows found in all; more than returned when the list was capped');
}
