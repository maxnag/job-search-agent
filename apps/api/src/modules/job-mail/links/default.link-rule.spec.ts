import { describe, expect, it } from 'vitest';

import { DEFAULT_LINK_RULE } from './default.link-rule.js';

describe('DEFAULT_LINK_RULE', () => {
  it('matches any site and lets the crawler open it', () => {
    expect(DEFAULT_LINK_RULE.matches('jobs.example.com')).toBe(true);
    expect(DEFAULT_LINK_RULE.noFetch).toBe(false);
  });

  it('keeps a vacancy link without its tracking', () => {
    expect(DEFAULT_LINK_RULE.canonicalURL(new URL('https://jobs.example.com/job/7?utm_campaign=a&gh_jid=7'), 'Backend Developer')).toBe(
      'https://jobs.example.com/job/7?gh_jid=7'
    );
  });

  it('drops a service link', () => {
    expect(DEFAULT_LINK_RULE.canonicalURL(new URL('https://jobs.example.com/alerts'), 'Unsubscribe')).toBeUndefined();
  });
});
