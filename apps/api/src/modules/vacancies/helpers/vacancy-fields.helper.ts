/**
 * Longest value of a vacancy field the LLM read from the web — generous for a real posting, short enough that a
 * planted one cannot flood the database or a Telegram card
 *
 * @type {Readonly<{ title: number; company: number; city: number; summary: number; skills: number; skillName: number }>}
 */
export const VACANCY_FIELD_LIMITS = {
  title: 200,
  company: 120,
  city: 80,
  summary: 1000,
  skills: 50,
  skillName: 60
} as const;

/**
 * Mark of a value cut short
 *
 * @type {string}
 */
const ELLIPSIS = '…';

/**
 * Text no longer than `maxChars`, cut with an ellipsis
 *
 * @param {string} text
 * @param {number} maxChars
 *
 * @returns {string}
 */
export function clipText(text: string, maxChars: number): string {
  return text.length > maxChars ? `${text.slice(0, maxChars - ELLIPSIS.length).trimEnd()}${ELLIPSIS}` : text;
}

/**
 * A text field that may be absent, clipped
 *
 * @param {string | null} text
 * @param {number} maxChars
 *
 * @returns {string | null}
 */
export function clipNullable(text: string | null, maxChars: number): string | null {
  return text === null ? null : clipText(text, maxChars);
}
