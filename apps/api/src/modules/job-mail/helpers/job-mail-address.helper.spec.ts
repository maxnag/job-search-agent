import { describe, expect, it } from 'vitest';

import { JobMailProviderEnum } from '@job-agent/shared';

import { jobMailMessageKey, senderDomain } from './job-mail-address.helper.js';

describe('job-mail-address.helper', () => {
  describe('jobMailMessageKey', () => {
    it('is the Message-ID header, the same with any provider', () => {
      expect(jobMailMessageKey(' <alert-1@jobs.example.com> ', JobMailProviderEnum.IMAP, '7:12')).toBe('<alert-1@jobs.example.com>');
    });

    it('falls back to the provider and its id of the e-mail without a Message-ID', () => {
      expect(jobMailMessageKey(undefined, JobMailProviderEnum.IMAP, '7:12')).toBe('imap:7:12');
      expect(jobMailMessageKey('  ', JobMailProviderEnum.IMAP, '7:12')).toBe('imap:7:12');
    });
  });

  describe('senderDomain', () => {
    it('is the lowercase part after the last @', () => {
      expect(senderDomain('Alerts@Jobs.Example.COM ')).toBe('jobs.example.com');
      expect(senderDomain('"a@b"@mail.example.org')).toBe('mail.example.org');
    });

    it('is empty for an address without @', () => {
      expect(senderDomain('')).toBe('');
      expect(senderDomain('postmaster')).toBe('');
    });
  });
});
