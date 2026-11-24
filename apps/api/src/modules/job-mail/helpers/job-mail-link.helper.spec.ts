import { describe, expect, it } from 'vitest';

import { isNoFetchURL, jobMailLinkRule, jobMailLinks } from './job-mail-link.helper.js';

describe('job-mail-link.helper', () => {
  describe('jobMailLinkRule', () => {
    it('is the rule of the site of the link', () => {
      expect(jobMailLinkRule('https://il.linkedin.com/jobs/view/1').name).toBe('linkedin');
      expect(jobMailLinkRule('https://www.glassdoor.co.uk/job-listing/x?jl=1').name).toBe('glassdoor');
    });

    it('is the default rule for any other site and for a broken link', () => {
      expect(jobMailLinkRule('https://jobs.example.com/job/1').name).toBe('default');
      expect(jobMailLinkRule('not a url').name).toBe('default');
    });
  });

  describe('isNoFetchURL', () => {
    it('is true for the sites the crawler never opens', () => {
      expect(isNoFetchURL('https://www.linkedin.com/jobs/view/123/')).toBe(true);
      expect(isNoFetchURL('https://www.glassdoor.com/job-listing/index.htm?jl=5')).toBe(true);
    });

    it('is false for a career page', () => {
      expect(isNoFetchURL('https://jobs.example.com/job/1')).toBe(false);
    });
  });

  describe('jobMailLinks', () => {
    it('opens redirects, cleans tracking, drops service links and keeps one link per vacancy', () => {
      const links = jobMailLinks([
        {
          url: 'https://click.example.net/r?url=' + encodeURIComponent('https://jobs.example.com/job/7?utm_source=alert'),
          text: '',
          context: ''
        },
        { url: 'https://jobs.example.com/job/7?ss=paid', text: 'Backend Developer', context: '' },
        { url: 'https://jobs.example.com/unsubscribe?t=1', text: 'Stop these e-mails', context: '' },
        { url: 'https://www.linkedin.com/comm/jobs/view/4100000001/?trackingId=x', text: 'Data Engineer', context: '' },
        { url: 'https://www.linkedin.com/comm/feed/', text: 'Your feed', context: '' },
        { url: 'not a url', text: 'Broken', context: '' }
      ]);

      expect(links).toEqual([
        { url: 'https://jobs.example.com/job/7', text: 'Backend Developer', context: '' },
        { url: 'https://www.linkedin.com/jobs/view/4100000001/', text: 'Data Engineer', context: '' }
      ]);
    });

    it('keeps the first text of a vacancy linked twice with texts', () => {
      expect(
        jobMailLinks([
          { url: 'https://jobs.example.com/job/7', text: 'Backend Developer', context: '' },
          { url: 'https://jobs.example.com/job/7#apply', text: 'Apply now', context: '' }
        ])
      ).toEqual([{ url: 'https://jobs.example.com/job/7', text: 'Backend Developer', context: '' }]);
    });

    it('is empty for no links', () => {
      expect(jobMailLinks([])).toEqual([]);
    });
  });
});
