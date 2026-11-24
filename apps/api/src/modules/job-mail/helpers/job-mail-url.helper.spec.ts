import { describe, expect, it } from 'vitest';

import { isHostOf, isServiceLink, unwrapRedirect, withoutTracking } from './job-mail-url.helper.js';

describe('job-mail-url.helper', () => {
  describe('unwrapRedirect', () => {
    it('opens a tracking redirect to the web address it carries', () => {
      const wrapped = new URL('https://click.example.net/r?id=9&url=' + encodeURIComponent('https://jobs.example.com/job/7'));

      expect(unwrapRedirect(wrapped).href).toBe('https://jobs.example.com/job/7');
    });

    it('reads every known parameter name', () => {
      expect(unwrapRedirect(new URL('https://t.example.net/?goto=https%3A%2F%2Fjobs.example.com%2F1')).href).toBe(
        'https://jobs.example.com/1'
      );
      expect(unwrapRedirect(new URL('https://t.example.net/?u=https%3A%2F%2Fjobs.example.com%2F2')).href).toBe(
        'https://jobs.example.com/2'
      );
    });

    it('leaves alone a link whose parameter is not a web address', () => {
      const link = new URL('https://jobs.example.com/job/7?url=mailto%3Ahr%40example.com&link=relative/path');

      expect(unwrapRedirect(link)).toBe(link);
    });

    it('leaves alone a link without a redirect parameter', () => {
      const link = new URL('https://jobs.example.com/job/7?ref=mail');

      expect(unwrapRedirect(link)).toBe(link);
    });
  });

  describe('withoutTracking', () => {
    it('drops the tracking parameters and the fragment, keeps the rest', () => {
      const link = new URL('https://jobs.example.com/job/7?utm_source=alert&UTM_Medium=mail&ss=paid&trk=x&gh_jid=42#apply');

      expect(withoutTracking(link)).toBe('https://jobs.example.com/job/7?gh_jid=42');
    });

    it('does not change the URL it was given', () => {
      const link = new URL('https://jobs.example.com/job/7?utm_source=alert');

      withoutTracking(link);

      expect(link.href).toBe('https://jobs.example.com/job/7?utm_source=alert');
    });

    it('keeps a parameter whose name only contains a tracking name', () => {
      expect(withoutTracking(new URL('https://jobs.example.com/?class=a&issuer=b'))).toBe('https://jobs.example.com/?class=a&issuer=b');
    });
  });

  describe('isServiceLink', () => {
    const page = new URL('https://jobs.example.com/job/7');

    it('is true for the service texts of a mailing', () => {
      for (const text of ['Unsubscribe', 'Manage my job alerts', 'E-mail preferences', 'Privacy Policy', 'View all jobs', 'Sign in']) {
        expect(isServiceLink(page, text)).toBe(true);
      }
    });

    it('is true for the service paths of a mailing', () => {
      for (const path of ['/unsubscribe?t=1', '/subscriptions', '/account/preferences/', '/settings']) {
        expect(isServiceLink(new URL(path, 'https://jobs.example.com'), 'Click here')).toBe(true);
      }
    });

    it('is false for a vacancy, even one named like a service word', () => {
      expect(isServiceLink(page, 'Senior Backend Developer')).toBe(false);
      expect(isServiceLink(page, 'Settings Platform Engineer')).toBe(false);
      expect(isServiceLink(new URL('https://jobs.example.com/jobs/settings-engineer'), 'Apply')).toBe(false);
    });
  });

  describe('isHostOf', () => {
    it('is true for the domain and its subdomains', () => {
      expect(isHostOf('example.com', 'example.com')).toBe(true);
      expect(isHostOf('il.jobs.example.com', 'example.com')).toBe(true);
    });

    it('is false for a host that only ends with the same letters', () => {
      expect(isHostOf('notexample.com', 'example.com')).toBe(false);
      expect(isHostOf('example.com.evil.net', 'example.com')).toBe(false);
    });
  });
});
