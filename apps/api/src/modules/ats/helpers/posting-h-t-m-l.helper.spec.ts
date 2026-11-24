import { describe, expect, it } from 'vitest';

import { escapeHTML, postingHTML } from './posting-h-t-m-l.helper.js';

describe('postingHTML', () => {
  it('puts the header lines before the sections', () => {
    expect(postingHTML(['Backend Engineer', 'Haifa'], ['<p>About</p>', '<ul><li>Node.js</li></ul>'])).toBe(
      '<main><p>Backend Engineer</p><p>Haifa</p><section><p>About</p></section><section><ul><li>Node.js</li></ul></section></main>'
    );
  });

  it('skips blank header lines and escapes the others', () => {
    expect(postingHTML([' ', null, undefined, 'R&D <Team>'], [])).toBe('<main><p>R&amp;D &lt;Team&gt;</p></main>');
  });

  it('keeps the sections as HTML', () => {
    expect(postingHTML([], ['<b>bold</b>'])).toBe('<main><section><b>bold</b></section></main>');
  });
});

describe('escapeHTML', () => {
  it('escapes the five special characters', () => {
    expect(escapeHTML(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  });

  it('leaves plain text as it is', () => {
    expect(escapeHTML('Тель-Авів 2026')).toBe('Тель-Авів 2026');
  });
});
