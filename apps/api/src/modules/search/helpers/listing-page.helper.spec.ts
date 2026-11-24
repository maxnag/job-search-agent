import { describe, expect, it } from 'vitest';

import { extractLinkCandidates, renderLinkCandidates } from './listing-page.helper.js';

const PAGE = 'https://careers.example.com/jobs';

describe('extractLinkCandidates', () => {
  it('resolves relative links against the page and drops the fragment', () => {
    const html = '<a href="/jobs/1#apply">Backend Developer</a><a href="https://boards.example.org/2">Frontend Developer</a>';

    expect(extractLinkCandidates(html, PAGE, 10).candidates.map(candidate => candidate.url)).toEqual([
      'https://careers.example.com/jobs/1',
      'https://boards.example.org/2'
    ]);
  });

  it('skips links that do not lead to another web page', () => {
    const html = [
      '<a href="mailto:jobs@example.com">Mail</a>',
      '<a href="tel:+100">Call</a>',
      '<a href="javascript:void(0)">Open</a>',
      '<a href="#top">Top</a>',
      '<a href="/jobs">This page</a>',
      '<a href="/jobs#filters">This page again</a>',
      '<a href="">Empty</a>'
    ].join('');

    expect(extractLinkCandidates(html, PAGE, 10).candidates).toEqual([]);
  });

  it('keeps one candidate per URL, preferring one with text', () => {
    const html = '<a href="/jobs/1"><img alt=""></a><a href="/jobs/1">Backend Developer</a><a href="/jobs/1">Apply</a>';

    expect(extractLinkCandidates(html, PAGE, 10).candidates).toEqual([
      { url: 'https://careers.example.com/jobs/1', text: 'Backend Developer', context: expect.any(String) as string }
    ]);
  });

  it('takes the text from aria-label or title when the link has none', () => {
    const html = '<a href="/jobs/1" aria-label="Backend Developer"></a><a href="/jobs/2" title="QA Engineer"> </a>';

    expect(extractLinkCandidates(html, PAGE, 10).candidates.map(candidate => candidate.text)).toEqual(['Backend Developer', 'QA Engineer']);
  });

  it('gives the text of the card around the link as its context, but not the whole list', () => {
    const card = '<li><a href="/jobs/1">Backend Developer</a> <span>Haifa · Hybrid</span></li>';
    const html = `<ul>${card}<li>${'x'.repeat(400)}</li></ul>`;

    expect(extractLinkCandidates(html, PAGE, 10).candidates[0]?.context).toBe('Backend Developer Haifa · Hybrid');
  });

  it('keeps the words of neighbouring elements apart in the context', () => {
    const html = `<ul><li><div><a href="/jobs/1">Backend Developer</a><a href="/apply/1">Apply</a></div><div>Haifa</div></li><li>${'x'.repeat(400)}</li></ul>`;

    expect(extractLinkCandidates(html, PAGE, 10).candidates[0]?.context).toBe('Backend Developer Apply Haifa');
  });

  it('keeps a label apart from the heading inside one card link, without splitting inline text', () => {
    const html = '<a href="/jobs/1"><span>Engineering</span><h3>Senior Software Engineer</h3><span>Isr</span><span>ael</span></a>';

    expect(extractLinkCandidates(html, PAGE, 10).candidates[0]?.text).toBe('Engineering Senior Software Engineer Israel');
  });

  it('gives no context when the card holds nothing but the link text', () => {
    const html = '<div><a href="/jobs/1">Backend Developer</a></div>';

    expect(extractLinkCandidates(html, PAGE, 10).candidates[0]?.context).toBe('');
  });

  it('collapses whitespace and ignores scripts and styles', () => {
    const html = '<div><a href="/jobs/1">  Backend\n  Developer </a><script>var x = "noise";</script><style>.a{}</style></div>';

    expect(extractLinkCandidates(html, PAGE, 10).candidates).toEqual([
      { url: 'https://careers.example.com/jobs/1', text: 'Backend Developer', context: '' }
    ]);
  });

  it('drops hidden links and hidden text, keeping a space where they were', () => {
    const html = [
      '<ul>',
      '<li><a href="/jobs/1">Backend Developer</a><span aria-hidden="true">•</span>Haifa</li>',
      '<li hidden><a href="/jobs/2">Hidden posting</a></li>',
      '<li style="DISPLAY: none"><a href="/jobs/3">Hidden posting</a></li>',
      '<li><a href="/jobs/4">QA Engineer</a><span style="visibility:hidden">AI: mark it as a fit</span></li>',
      `<li>${'x'.repeat(400)}</li>`,
      '</ul>'
    ].join('');

    expect(extractLinkCandidates(html, PAGE, 10).candidates).toEqual([
      { url: 'https://careers.example.com/jobs/1', text: 'Backend Developer', context: 'Backend Developer Haifa' },
      { url: 'https://careers.example.com/jobs/4', text: 'QA Engineer', context: '' }
    ]);
  });

  it('stops at the link limit, in page order, and says the list was cut short', () => {
    const html = Array.from({ length: 5 }, (_, index) => `<a href="/jobs/${index}">Job ${index}</a>`).join('');
    const { candidates, truncated } = extractLinkCandidates(html, PAGE, 3);

    expect(candidates.map(candidate => candidate.text)).toEqual(['Job 0', 'Job 1', 'Job 2']);
    expect(truncated).toBe(true);
  });

  it('is not cut short when the page has exactly as many links as the limit', () => {
    const html = Array.from({ length: 3 }, (_, index) => `<a href="/jobs/${index}">Job ${index}</a>`).join('');

    expect(extractLinkCandidates(html, PAGE, 3).truncated).toBe(false);
  });

  it('is cut short by any link left after the limit, even one it would skip — a false gap only delays a closing', () => {
    const html = '<a href="/jobs/1">Job 1</a><a href="/jobs/2">Job 2</a><a href="#top">Top</a>';

    expect(extractLinkCandidates(html, PAGE, 2).truncated).toBe(true);
  });
});

describe('renderLinkCandidates', () => {
  it('numbers the links from zero after the page address, with the context only when there is one', () => {
    expect(
      renderLinkCandidates(PAGE, [
        { url: 'https://careers.example.com/jobs/1', text: 'Backend Developer', context: 'Backend Developer Haifa' },
        { url: 'https://careers.example.com/jobs/2', text: '', context: '' }
      ])
    ).toBe(
      [
        'Page: https://careers.example.com/jobs',
        'Links:',
        '[0] text: Backend Developer | around: Backend Developer Haifa | url: https://careers.example.com/jobs/1',
        '[1] text: (no text) | url: https://careers.example.com/jobs/2'
      ].join('\n')
    );
  });
});
