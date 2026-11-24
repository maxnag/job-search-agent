import { describe, expect, it } from 'vitest';

import { findPagination } from './listing-pagination.helper.js';

const PAGE = 'https://careers.example.com/en/search-jobs/results';

const POSTINGS = '<a href="/jobs/1">Backend Developer</a><a href="/jobs/2">QA Engineer</a>';

describe('findPagination', () => {
  describe('rel="next"', () => {
    it('takes the address of a rel="next" link in the body', () => {
      expect(findPagination(`${POSTINGS}<a rel="next" href="?page=2">2</a>`, PAGE)).toEqual({
        nextURL: 'https://careers.example.com/en/search-jobs/results?page=2'
      });
    });

    it('takes the address of a rel="next" link in the head', () => {
      const html = '<html><head><link rel="prev next" href="/en/search-jobs/results/2"></head><body></body></html>';

      expect(findPagination(html, PAGE)).toEqual({ nextURL: 'https://careers.example.com/en/search-jobs/results/2' });
    });

    it('counts a rel="next" link to another origin as pagination, without an address', () => {
      expect(findPagination('<a rel="next" href="https://elsewhere.example.org/?page=2">2</a>', PAGE)).toEqual({});
    });

    it('prefers rel="next" to a "Next" link and to a numbered one', () => {
      const html = '<a href="?cursor=x">Next</a><a href="?page=2">2</a><a rel="next" href="?page=2&sort=new">›</a>';

      expect(findPagination(html, PAGE)?.nextURL).toBe('https://careers.example.com/en/search-jobs/results?page=2&sort=new');
    });
  });

  describe('a "Next" link', () => {
    it.each([
      ['Next', 'Next'],
      ['Next with an arrow', 'Next ›'],
      ['Next page', 'Next page'],
      ['Hebrew', 'הבא'],
      ['Hebrew, to the next page', 'לעמוד הבא'],
      ['Ukrainian', 'Наступна'],
      ['Ukrainian "further"', '← Далі →']
    ])('follows a link that says %s, to an address without a page number', (_case, text) => {
      expect(findPagination(`<a href="?cursor=abc">${text}</a>`, PAGE)).toEqual({
        nextURL: 'https://careers.example.com/en/search-jobs/results?cursor=abc'
      });
    });

    it('reads an arrow without words by its aria-label', () => {
      expect(findPagination('<a href="?after=x" aria-label="Next page">›</a>', PAGE)?.nextURL).toBe(
        'https://careers.example.com/en/search-jobs/results?after=x'
      );
    });

    it('prefers a "Next" link to a numbered one', () => {
      expect(findPagination('<a href="?page=7">7</a><a href="?cursor=abc">Next</a>', PAGE)?.nextURL).toBe(
        'https://careers.example.com/en/search-jobs/results?cursor=abc'
      );
    });

    it.each([
      ['to another origin', '<a href="https://elsewhere.example.org/jobs">Next</a>'],
      ['to the page itself', '<a href="#">Next</a>'],
      ['with words around "next"', '<a href="/blog/next-steps">Next steps in your career</a>']
    ])('ignores a link %s', (_case, html) => {
      expect(findPagination(html, PAGE)).toBeUndefined();
    });
  });

  describe('a numbered link', () => {
    it.each(['page', 'p', 'pg', 'pageNumber'])('follows a link with %s past the first page', param => {
      expect(findPagination(`<a href="?${param}=2">2</a>`, PAGE)?.nextURL).toBe(
        `https://careers.example.com/en/search-jobs/results?${param}=2`
      );
    });

    it.each(['offset', 'start'])('follows a link with %s past 0', param => {
      expect(findPagination(`<a href="?${param}=20">Older</a>`, PAGE)?.nextURL).toBe(
        `https://careers.example.com/en/search-jobs/results?${param}=20`
      );
    });

    it('follows a path that ends with /page/<N>', () => {
      expect(findPagination('<a href="/en/jobs/page/2/">2</a>', PAGE)?.nextURL).toBe('https://careers.example.com/en/jobs/page/2/');
    });

    it('follows a numbered link of the same origin under another path', () => {
      expect(findPagination('<a href="/search-jobs/results?p=2">2</a>', PAGE)?.nextURL).toBe(
        'https://careers.example.com/search-jobs/results?p=2'
      );
    });

    it('takes the closest page ahead of the current one, not the last', () => {
      const html = '<a href="?page=2">2</a><a href="?page=4">4</a><a href="?page=9">Last</a>';

      expect(findPagination(html, `${PAGE}?page=3`)?.nextURL).toBe('https://careers.example.com/en/search-jobs/results?page=4');
    });

    it('counts pages from 0 when the links have a page 0', () => {
      const html = '<a href="?page=0">1</a><a href="?page=1">2</a><a href="?page=2">3</a>';

      expect(findPagination(html, PAGE)?.nextURL).toBe('https://careers.example.com/en/search-jobs/results?page=1');
    });

    it('sees no pagination on the last page', () => {
      expect(findPagination(`${POSTINGS}<a href="?page=1">1</a><a href="?page=2">2</a>`, `${PAGE}?page=2`)).toBeUndefined();
    });

    it.each([
      ['the first page only', '<a href="?page=1">1</a>'],
      ['an offset of 0', '<a href="?start=0">Newest</a>'],
      ['a page number that is not a number', '<a href="?page=all">All</a>'],
      ['another origin', '<a href="https://elsewhere.example.org/jobs?page=2">2</a>']
    ])('ignores a link to %s', (_case, html) => {
      expect(findPagination(html, PAGE)).toBeUndefined();
    });
  });

  describe('a button that loads more', () => {
    it.each([
      ['Load more', '<button>Load more</button>'],
      ['Show more jobs with an arrow', '<a href="#">Show more jobs ↓</a>'],
      ['More positions', '<button> More   positions </button>'],
      ['Next page', '<button>Next page</button>'],
      ['Next page as an aria-label', '<button aria-label="Next page"><svg></svg></button>'],
      ['Hebrew next page', '<button>לעמוד הבא</button>'],
      ['Ukrainian next page', '<button>Наступна сторінка</button>']
    ])('counts a visible %s as pagination, without an address', (_case, html) => {
      expect(findPagination(html, PAGE)).toEqual({});
    });

    it('ignores a bare "Next" button — a slider, not the list', () => {
      expect(findPagination(`${POSTINGS}<button>Next</button><button>Previous</button>`, PAGE)).toBeUndefined();
    });

    it.each([
      ['hidden', '<button hidden>Load more</button>'],
      ['not displayed', '<button style="display: none">Load more</button>'],
      ['inside a hidden block', '<div aria-hidden="true"><button>Load more</button></div>']
    ])('ignores a %s button — the site hides it once the list is whole', (_case, html) => {
      expect(findPagination(html, PAGE)).toBeUndefined();
    });
  });

  it('sees no pagination on a page with the whole list', () => {
    expect(findPagination(`<nav><a href="/">Home</a><a href="/about">About</a></nav>${POSTINGS}`, PAGE)).toBeUndefined();
  });

  it('sees no pagination when the page address cannot be read', () => {
    expect(findPagination('<a rel="next" href="?page=2">2</a>', 'not a url')).toBeUndefined();
  });
});
