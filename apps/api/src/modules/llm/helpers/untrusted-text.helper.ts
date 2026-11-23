/**
 * Characters a regular expression treats specially
 *
 * @type {RegExp}
 */
const REGEXP_SPECIAL = /[.*+?^${}()|[\]\\]/g;

/**
 * Text from the web inside `<tag>…</tag>`, so the prompt can tell the model where the data starts and ends; every
 * opening or closing `tag` inside the text is removed — the text cannot close the block and speak as the prompt
 *
 * @param {string} tag
 * @param {string} text
 *
 * @returns {string}
 */
export function fenceUntrusted(tag: string, text: string): string {
  const escapedTag = tag.replace(REGEXP_SPECIAL, String.raw`\$&`);
  const tagPattern = new RegExp(`<\\s*/?\\s*${escapedTag}\\b[^>]*>`, 'gi');

  return `<${tag}>\n${text.replace(tagPattern, '')}\n</${tag}>`;
}
