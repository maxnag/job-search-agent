import { describe, expect, it } from 'vitest';

import { ROBOTS_MAX_LENGTH, isPathAllowed, parseRobotsRules } from './robots-rules.helper.js';

describe('parseRobotsRules', () => {
  it('keeps the rules of the * group only', () => {
    const text = ['User-agent: Googlebot', 'Disallow: /google', '', 'User-agent: *', 'Disallow: /private', 'Allow: /private/jobs'].join(
      '\n'
    );

    expect(parseRobotsRules(text)).toEqual([
      { allow: false, pattern: '/private' },
      { allow: true, pattern: '/private/jobs' }
    ]);
  });

  it('applies the rules to every agent of a group of consecutive User-agent lines', () => {
    expect(parseRobotsRules('User-agent: Bingbot\nUser-agent: *\nDisallow: /a')).toEqual([{ allow: false, pattern: '/a' }]);
  });

  it('opens a new group after a rule line', () => {
    expect(parseRobotsRules('User-agent: *\nDisallow: /a\nUser-agent: Bingbot\nDisallow: /b')).toEqual([{ allow: false, pattern: '/a' }]);
  });

  it('merges several * groups', () => {
    expect(parseRobotsRules('User-agent: *\nDisallow: /a\n\nUser-agent: other\nDisallow: /x\n\nUser-agent: *\nDisallow: /b')).toEqual([
      { allow: false, pattern: '/a' },
      { allow: false, pattern: '/b' }
    ]);
  });

  it('reads keys in any case, drops comments, ignores Sitemap and unknown lines', () => {
    const text = [
      'USER-AGENT: *   # everyone',
      'disallow: /tmp # temporary',
      'Sitemap: https://example.com/s.xml',
      'Crawl-delay: 5',
      'garbage'
    ].join('\r\n');

    expect(parseRobotsRules(text)).toEqual([{ allow: false, pattern: '/tmp' }]);
  });

  it('treats an empty Disallow as no rule', () => {
    expect(parseRobotsRules('User-agent: *\nDisallow:')).toEqual([]);
  });

  it('reads no further than the size limit', () => {
    const text = `User-agent: *\n${' '.repeat(ROBOTS_MAX_LENGTH)}\nDisallow: /late`;

    expect(parseRobotsRules(text)).toEqual([]);
  });
});

describe('isPathAllowed', () => {
  it('allows everything without rules', () => {
    expect(isPathAllowed([], '/jobs')).toBe(true);
  });

  it('forbids a path under a Disallow prefix and allows one beside it', () => {
    const rules = [{ allow: false, pattern: '/private' }];

    expect(isPathAllowed(rules, '/private/1')).toBe(false);
    expect(isPathAllowed(rules, '/public')).toBe(true);
  });

  it('lets the longest matching pattern win', () => {
    const rules = [
      { allow: false, pattern: '/careers' },
      { allow: true, pattern: '/careers/jobs' }
    ];

    expect(isPathAllowed(rules, '/careers/jobs/1')).toBe(true);
    expect(isPathAllowed(rules, '/careers/team')).toBe(false);
  });

  it('lets Allow win a tie of the same length, in either order', () => {
    expect(
      isPathAllowed(
        [
          { allow: false, pattern: '/jobs' },
          { allow: true, pattern: '/jobs' }
        ],
        '/jobs'
      )
    ).toBe(true);
    expect(
      isPathAllowed(
        [
          { allow: true, pattern: '/jobs' },
          { allow: false, pattern: '/jobs' }
        ],
        '/jobs'
      )
    ).toBe(true);
  });

  it('reads * as any run of characters', () => {
    const rules = [{ allow: false, pattern: '/*.pdf' }];

    expect(isPathAllowed(rules, '/files/cv.pdf')).toBe(false);
    expect(isPathAllowed(rules, '/files/cv.html')).toBe(true);
  });

  it('anchors a pattern ending in $', () => {
    const rules = [{ allow: false, pattern: '/jobs$' }];

    expect(isPathAllowed(rules, '/jobs')).toBe(false);
    expect(isPathAllowed(rules, '/jobs/1')).toBe(true);
  });

  it('matches the query too and treats regular expression characters literally', () => {
    const rules = [{ allow: false, pattern: '/search?q=' }];

    expect(isPathAllowed(rules, '/search?q=node')).toBe(false);
    expect(isPathAllowed(rules, '/searchXq=node')).toBe(true);
  });

  it('always allows robots.txt itself', () => {
    expect(isPathAllowed([{ allow: false, pattern: '/' }], '/robots.txt')).toBe(true);
  });
});
