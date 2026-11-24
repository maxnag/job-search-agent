/**
 * Characters escaped in a text put into HTML
 *
 * @type {Readonly<Record<string, string>>}
 */
const HTML_ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

/**
 * HTML of a posting: the header fields as escaped paragraphs — the system gives them as plain text — then the
 * description sections, which are HTML already
 *
 * @param {readonly (string | null | undefined)[]} header
 * @param {readonly string[]} sections
 *
 * @returns {string}
 */
export function postingHTML(header: readonly (string | null | undefined)[], sections: readonly string[]): string {
  const lines = header
    .map(line => line?.trim())
    .filter((line): line is string => !!line)
    .map(line => `<p>${escapeHTML(line)}</p>`);

  const body = sections.map(section => `<section>${section}</section>`).join('');

  return `<main>${lines.join('')}${body}</main>`;
}

/**
 * A text safe to put into HTML
 *
 * @param {string} text
 *
 * @returns {string}
 */
export function escapeHTML(text: string): string {
  return text.replace(/[&<>"']/g, char => HTML_ESCAPES[char] ?? char);
}
