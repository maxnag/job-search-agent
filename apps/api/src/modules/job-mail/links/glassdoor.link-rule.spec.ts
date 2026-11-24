import { describe, expect, it } from 'vitest';

import { GLASSDOOR_LINK_RULE } from './glassdoor.link-rule.js';

describe('GLASSDOOR_LINK_RULE', () => {
  it('is never fetched', () => {
    expect(GLASSDOOR_LINK_RULE.noFetch).toBe(true);
  });

  it('matches every national site of Glassdoor', () => {
    expect(GLASSDOOR_LINK_RULE.matches('www.glassdoor.com')).toBe(true);
    expect(GLASSDOOR_LINK_RULE.matches('glassdoor.co.uk')).toBe(true);
    expect(GLASSDOOR_LINK_RULE.matches('notglassdoor.com')).toBe(false);
  });

  it('turns a link with a listing id into one canonical address', () => {
    expect(GLASSDOOR_LINK_RULE.canonicalURL(new URL('https://www.glassdoor.com/partner/jobListing.htm?pos=1&jl=1009000&ao=x'), '')).toBe(
      'https://www.glassdoor.com/job-listing/index.htm?jl=1009000'
    );
    expect(GLASSDOOR_LINK_RULE.canonicalURL(new URL('https://www.glassdoor.co.uk/job?jobListingId=77'), '')).toBe(
      'https://www.glassdoor.com/job-listing/index.htm?jl=77'
    );
  });

  it('drops a link without a numeric listing id', () => {
    expect(GLASSDOOR_LINK_RULE.canonicalURL(new URL('https://www.glassdoor.com/Reviews/index.htm'), 'Reviews')).toBeUndefined();
    expect(GLASSDOOR_LINK_RULE.canonicalURL(new URL('https://www.glassdoor.com/job?jl=abc'), 'Data Engineer')).toBeUndefined();
  });
});
