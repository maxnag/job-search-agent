import { describe, expect, it } from 'vitest';

import en from '../messages/en.json';
import uk from '../messages/uk.json';

/**
 * Every key of a dictionary as a dotted path, each with its text
 *
 * @param {Record<string, unknown>} messages
 * @param {string} prefix
 *
 * @returns {[string, unknown][]}
 */
function flatten(messages: Record<string, unknown>, prefix = ''): [string, unknown][] {
  return Object.entries(messages).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;

    return value !== null && typeof value === 'object'
      ? flatten(value as Record<string, unknown>, path)
      : [[path, value] as [string, unknown]];
  });
}

describe('dictionaries', () => {
  const dictionaries = { en: flatten(en), uk: flatten(uk) };

  it('have the same keys in English and Ukrainian', () => {
    const keys = (entries: [string, unknown][]): string[] => entries.map(([key]) => key).sort((left, right) => left.localeCompare(right));

    expect(keys(dictionaries.uk)).toEqual(keys(dictionaries.en));
  });

  it.each(Object.entries(dictionaries))('have no empty text in %s', (_locale, entries) => {
    const empty = entries.filter(([, text]) => typeof text !== 'string' || text.trim() === '').map(([key]) => key);

    expect(empty).toEqual([]);
  });
});
