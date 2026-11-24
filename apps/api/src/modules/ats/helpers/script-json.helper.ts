/**
 * Brackets that open a JSON value
 *
 * @type {ReadonlySet<string>}
 */
const OPENERS: ReadonlySet<string> = new Set(['[', '{']);

/**
 * Brackets that close a JSON value
 *
 * @type {ReadonlySet<string>}
 */
const CLOSERS: ReadonlySet<string> = new Set([']', '}']);

/**
 * The JSON value a page script assigns to a variable — `NAME = {…}` or `NAME = […]` — found by matching brackets
 * outside strings; `undefined` if the page has no such assignment or the value is not JSON
 *
 * @param {string} html
 * @param {string} name
 *
 * @returns {unknown}
 */
export function scriptJSON(html: string, name: string): unknown {
  const assignment = new RegExp(`\\b${name}\\s*=\\s*(?=[\\[{])`).exec(html);

  if (!assignment) {
    return undefined;
  }

  const start = assignment.index + assignment[0].length;
  const end = valueEnd(html, start);

  if (end === undefined) {
    return undefined;
  }

  try {
    return JSON.parse(html.slice(start, end)) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * Index just past the bracket that closes the value opened at `start`
 *
 * @param {string} text
 * @param {number} start
 *
 * @returns {number | undefined}
 */
function valueEnd(text: string, start: number): number | undefined {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index++) {
    const char = text.charAt(index);

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (OPENERS.has(char)) {
      depth++;
    } else if (CLOSERS.has(char)) {
      depth--;

      if (depth === 0) {
        return index + 1;
      }
    }
  }

  return undefined;
}
