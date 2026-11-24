/**
 * Most edits a suggestion may be away from the word typed
 *
 * @type {number}
 */
const MAX_DISTANCE = 2;

/**
 * A suggestion is at most a third of the typed word away — a short typo cannot match anything
 *
 * @type {number}
 */
const MAX_DISTANCE_SHARE = 3;

/**
 * Characters a shell word may hold without quotes
 *
 * @type {RegExp}
 */
const PLAIN_WORD = /^[\w@%+=:,./-]+$/;

/**
 * A single quote inside a single-quoted shell word: close the quotes, an escaped quote, open them again
 *
 * @type {string}
 */
const QUOTE_INSIDE_QUOTES = "'\\''";

/**
 * Damerau — Levenshtein distance (optimal string alignment): the number of letters inserted, deleted, replaced or
 * swapped with a neighbour to turn one word into the other
 *
 * @param {string} left
 * @param {string} right
 *
 * @returns {number}
 */
export function editDistance(left: string, right: string): number {
  const width = right.length + 1;
  const cells: number[] = [];
  const at = (row: number, column: number): number => cells[row * width + column] ?? 0;

  for (let row = 0; row <= left.length; row++) {
    for (let column = 0; column <= right.length; column++) {
      if (row === 0 || column === 0) {
        cells[row * width + column] = row + column;
        continue;
      }

      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      let distance = Math.min(at(row - 1, column) + 1, at(row, column - 1) + 1, at(row - 1, column - 1) + cost);

      if (row > 1 && column > 1 && left[row - 1] === right[column - 2] && left[row - 2] === right[column - 1]) {
        distance = Math.min(distance, at(row - 2, column - 2) + 1);
      }

      cells[row * width + column] = distance;
    }
  }

  return at(left.length, right.length);
}

/**
 * The one candidate close to a mistyped word — none when the nearest is too far or two are equally near
 *
 * @param {string} word
 * @param {readonly string[]} candidates
 *
 * @returns {string | undefined}
 */
export function closestWord(word: string, candidates: readonly string[]): string | undefined {
  const typed = word.toLowerCase();
  const distances = candidates.map(candidate => ({ candidate, distance: editDistance(typed, candidate.toLowerCase()) }));
  const nearest = Math.min(...distances.map(entry => entry.distance));
  const closest = distances.filter(entry => entry.distance === nearest);

  if (closest.length !== 1 || nearest > MAX_DISTANCE || nearest * MAX_DISTANCE_SHARE > typed.length) {
    return undefined;
  }

  return closest[0]?.candidate;
}

/**
 * A command line ready to paste into a shell: words with spaces or shell characters single-quoted
 *
 * @param {readonly string[]} words
 *
 * @returns {string}
 */
export function shellCommand(words: readonly string[]): string {
  return words.map(word => (PLAIN_WORD.test(word) ? word : `'${word.replaceAll("'", QUOTE_INSIDE_QUOTES)}'`)).join(' ');
}
