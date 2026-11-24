import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { JobMailProviderEnum } from '@job-agent/shared';

import { createConfigMock } from '../../../../test/config-service.mock.js';
import type { IEnv } from '../../../config/env.schema.js';
import { IMAPJobMailProvider } from './i-m-a-p-job-mail.provider.js';
import { IMAPJobMailbox } from './i-m-a-p-job.mailbox.js';

const imap = vi.hoisted(() => ({
  options: [] as unknown[],
  connect: vi.fn(),
  mailboxOpen: vi.fn(),
  logout: vi.fn(),
  close: vi.fn(),
  on: vi.fn()
}));

vi.mock('imapflow', () => ({
  ImapFlow: class {
    connect = imap.connect;
    mailboxOpen = imap.mailboxOpen;
    logout = imap.logout;
    close = imap.close;
    on = imap.on;

    constructor(options: unknown) {
      imap.options.push(options);
    }
  }
}));

/**
 * Keys of a configured mailbox
 *
 * @type {Partial<Record<keyof IEnv, unknown>>}
 */
const ENV: Partial<Record<keyof IEnv, unknown>> = {
  JOB_MAIL_IMAP_HOST: 'imap.example.com',
  JOB_MAIL_IMAP_PORT: 993,
  JOB_MAIL_IMAP_USER: 'owner@example.org',
  JOB_MAIL_IMAP_PASSWORD: 'abcd efgh ijkl mnop',
  JOB_MAIL_IMAP_MAILBOX: 'INBOX',
  JOB_MAIL_TIMEOUT_MS: 15_000
};

describe('IMAPJobMailProvider (unit)', () => {
  let moduleFixture: TestingModule;
  let subjectUnderTest: IMAPJobMailProvider;

  /**
   * Build the provider with the given keys
   *
   * @param {Partial<Record<keyof IEnv, unknown>>} env
   *
   * @returns {Promise<void>}
   */
  async function compile(env: Partial<Record<keyof IEnv, unknown>>): Promise<void> {
    moduleFixture = await Test.createTestingModule({
      providers: [IMAPJobMailProvider, { provide: ConfigService, useValue: createConfigMock(env) }]
    }).compile();

    subjectUnderTest = moduleFixture.get(IMAPJobMailProvider);
  }

  beforeEach(async () => {
    imap.options.length = 0;
    imap.connect.mockReset().mockResolvedValue(undefined);
    imap.mailboxOpen.mockReset().mockResolvedValue({ path: 'INBOX', uidValidity: 7n });
    imap.logout.mockReset().mockResolvedValue(undefined);
    imap.close.mockReset();
    imap.on.mockReset();
    await compile(ENV);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await moduleFixture.close();
  });

  it('should be defined', () => {
    expect(subjectUnderTest).toBeDefined();
    expect(subjectUnderTest.provider).toBe(JobMailProviderEnum.IMAP);
  });

  describe('isConfigured', () => {
    it('is true with the user and the password', () => {
      expect(subjectUnderTest.isConfigured()).toBe(true);
    });

    it('is false without either of them', async () => {
      await moduleFixture.close();
      await compile({ ...ENV, JOB_MAIL_IMAP_PASSWORD: undefined });

      expect(subjectUnderTest.isConfigured()).toBe(false);

      await moduleFixture.close();
      await compile({ ...ENV, JOB_MAIL_IMAP_USER: undefined });

      expect(subjectUnderTest.isConfigured()).toBe(false);
    });
  });

  describe('open', () => {
    it('connects over TLS with the app password without its spaces, quietly, and opens the folder read-only', async () => {
      await expect(subjectUnderTest.open()).resolves.toBeInstanceOf(IMAPJobMailbox);

      expect(imap.options[0]).toMatchObject({
        host: 'imap.example.com',
        port: 993,
        secure: true,
        auth: { user: 'owner@example.org', pass: 'abcdefghijklmnop' },
        logger: false,
        disableAutoIdle: true,
        connectionTimeout: 15_000,
        greetingTimeout: 15_000,
        socketTimeout: 15_000
      });
      expect(imap.mailboxOpen).toHaveBeenCalledWith('INBOX', { readOnly: true });
    });

    it('warns about a connection error without its details', async () => {
      const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

      await subjectUnderTest.open();

      const onError = imap.on.mock.calls.find(([event]) => event === 'error')?.[1] as (error: Error) => void;

      onError(new Error('ECONNRESET'));

      expect(warn).toHaveBeenCalledWith({ message: 'IMAP connection error', reason: 'ECONNRESET' });
    });

    it('refuses to connect without the keys', async () => {
      await moduleFixture.close();
      await compile({ ...ENV, JOB_MAIL_IMAP_PASSWORD: undefined });

      await expect(subjectUnderTest.open()).rejects.toThrow('JOB_MAIL_NOT_CONFIGURED');
      expect(imap.connect).not.toHaveBeenCalled();
    });

    it('tells a refused password from a lost connection', async () => {
      imap.connect.mockRejectedValueOnce(Object.assign(new Error('Invalid credentials'), { authenticationFailed: true }));

      await expect(subjectUnderTest.open()).rejects.toThrow('JOB_MAIL_AUTH_FAILED');

      imap.connect.mockRejectedValueOnce(new Error('getaddrinfo ENOTFOUND'));

      await expect(subjectUnderTest.open()).rejects.toThrow('JOB_MAIL_CONNECTION_FAILED: getaddrinfo ENOTFOUND');
      expect(imap.close).toHaveBeenCalledTimes(2);
    });

    it('logs out when the folder does not open', async () => {
      imap.mailboxOpen.mockRejectedValue(new Error('Mailbox does not exist'));

      await expect(subjectUnderTest.open()).rejects.toThrow(
        'JOB_MAIL_CONNECTION_FAILED: folder "INBOX" not opened — Mailbox does not exist'
      );
      expect(imap.logout).toHaveBeenCalledTimes(1);
    });
  });
});
