/**
 * Legal suffixes that do not tell one company from another
 *
 * @type {ReadonlySet<string>}
 */
const LEGAL_SUFFIXES: ReadonlySet<string> = new Set([
  'ltd',
  'limited',
  'inc',
  'incorporated',
  'llc',
  'corp',
  'corporation',
  'co',
  'plc',
  'gmbh',
  'ag',
  'sa',
  'bv',
  'bm'
]);

/**
 * Lower case, letters and digits of any script, single spaces
 *
 * @param {string} value
 *
 * @returns {string[]}
 */
function words(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(' ')
    .filter(word => word !== '');
}

/**
 * A company name without punctuation and legal suffixes — `Acme Ltd.` and `ACME` are one company
 *
 * @param {string} company
 *
 * @returns {string}
 */
export function normalizeCompany(company: string): string {
  const parts = words(company);

  while (parts.length > 1 && LEGAL_SUFFIXES.has(parts.at(-1) ?? '')) {
    parts.pop();
  }

  return parts.join(' ');
}

/**
 * A city name reduced to its letters — `Be'er Sheva` and `Beer-Sheva` are one city
 *
 * @param {string} city
 *
 * @returns {string}
 */
export function normalizeCity(city: string): string {
  return words(city).join('');
}

/**
 * The key one vacancy has wherever it is found: normalized company and title
 *
 * @param {string} company
 * @param {string} title
 *
 * @returns {string}
 */
export function vacancyDedupKey(company: string, title: string): string {
  return `${normalizeCompany(company)}|${words(title).join(' ')}`;
}
