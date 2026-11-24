import { describe, expect, it } from 'vitest';

import { LINKEDIN_LINK_RULE } from './linkedin.link-rule.js';

describe('LINKEDIN_LINK_RULE', () => {
  it('is never fetched', () => {
    expect(LINKEDIN_LINK_RULE.noFetch).toBe(true);
  });

  it('matches linkedin.com and its subdomains only', () => {
    expect(LINKEDIN_LINK_RULE.matches('www.linkedin.com')).toBe(true);
    expect(LINKEDIN_LINK_RULE.matches('il.linkedin.com')).toBe(true);
    expect(LINKEDIN_LINK_RULE.matches('linkedin.com.example.net')).toBe(false);
  });

  it('turns every form of a vacancy link into one canonical address', () => {
    for (const path of ['/jobs/view/4100000001', '/comm/jobs/view/4100000001/', '/jobs/view/senior-developer-at-northwind-4100000001/']) {
      expect(LINKEDIN_LINK_RULE.canonicalURL(new URL(path + '?trackingId=x&refId=y', 'https://www.linkedin.com'), '')).toBe(
        'https://www.linkedin.com/jobs/view/4100000001/'
      );
    }
  });

  it('drops any other LinkedIn link', () => {
    for (const path of ['/comm/feed/', '/jobs/search/?keywords=dev', '/jobs/view/', '/in/someone', '/jobs/view/4100000001/apply']) {
      expect(LINKEDIN_LINK_RULE.canonicalURL(new URL(path, 'https://www.linkedin.com'), 'Data Engineer')).toBeUndefined();
    }
  });
});
