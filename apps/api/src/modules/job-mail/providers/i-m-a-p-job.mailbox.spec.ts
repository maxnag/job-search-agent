import { type DeepMocked, createMock } from '@golevelup/ts-vitest';
import type { FetchMessageObject, ImapFlow } from 'imapflow';
import { beforeEach, describe, expect, it } from 'vitest';

import type { IJobMailHeaders } from '../interfaces/job-mail-message.interface.js';
import { IMAPJobMailbox } from './i-m-a-p-job.mailbox.js';

/**
 * Start of the window of the tests
 *
 * @type {Date}
 */
const SINCE = new Date('2026-11-23T12:00:00Z');

/**
 * A job alert as Gmail serves it: multipart, the HTML part quoted-printable
 *
 * @type {string}
 */
const ALERT_SOURCE = [
  'From: Northwind Careers <alerts@jobs.example.com>',
  'To: owner@example.org',
  'Subject: 2 new jobs for you',
  'Message-ID: <alert-1@jobs.example.com>',
  'MIME-Version: 1.0',
  'Content-Type: multipart/alternative; boundary="b1"',
  '',
  '--b1',
  'Content-Type: text/plain; charset=utf-8',
  '',
  'Backend Developer https://jobs.example.com/job/7',
  '--b1',
  'Content-Type: text/html; charset=utf-8',
  'Content-Transfer-Encoding: quoted-printable',
  '',
  '<a href=3D"https://jobs.example.com/job/7">Backend Developer</a>',
  '--b1--',
  ''
].join('\r\n');

/**
 * A message of the IMAP server
 *
 * @param {number} uid
 * @param {Partial<FetchMessageObject>} changes
 *
 * @returns {FetchMessageObject}
 */
function message(uid: number, changes: Partial<FetchMessageObject> = {}): FetchMessageObject {
  return {
    seq: uid,
    uid,
    internalDate: new Date(SINCE.getTime() + uid * 60_000),
    envelope: {
      date: new Date(SINCE.getTime() + uid * 60_000),
      subject: ` Jobs ${uid} `,
      messageId: `<mail-${uid}@example.com>`,
      from: [{ name: ' Northwind Careers ', address: 'Alerts@Jobs.Example.com' }]
    },
    ...changes
  };
}

/**
 * Headers of an e-mail of the mailbox
 *
 * @param {string} providerId
 *
 * @returns {IJobMailHeaders}
 */
function headers(providerId: string): IJobMailHeaders {
  return {
    providerId,
    messageKey: '<alert-1@jobs.example.com>',
    senderName: 'Northwind Careers',
    senderAddress: 'alerts@jobs.example.com',
    subject: '2 new jobs for you',
    receivedAt: SINCE
  };
}

describe('IMAPJobMailbox (unit)', () => {
  let client: DeepMocked<ImapFlow>;
  let subjectUnderTest: IMAPJobMailbox;

  beforeEach(() => {
    client = createMock<ImapFlow>();
    subjectUnderTest = new IMAPJobMailbox(client, 7n);
  });

  it('should be defined', () => {
    expect(subjectUnderTest).toBeDefined();
  });

  describe('listHeaders', () => {
    it('searches from a day before the window, keeps the window by arrival time, newest first, cut to the limit', async () => {
      client.search.mockResolvedValue([1, 2, 3, 4]);
      client.fetchAll.mockResolvedValue([
        message(1),
        message(2),
        message(3),
        message(4, { internalDate: new Date(SINCE.getTime() - 60_000) })
      ]);

      const result = await subjectUnderTest.listHeaders(SINCE, 2);

      expect(client.search).toHaveBeenCalledWith({ since: new Date('2026-11-22T12:00:00Z') }, { uid: true });
      expect(client.fetchAll).toHaveBeenCalledWith('1,2,3,4', { uid: true, envelope: true, internalDate: true }, { uid: true });
      expect(result.map(item => item.providerId)).toEqual(['7:3', '7:2']);
      expect(result[0]).toEqual({
        providerId: '7:3',
        messageKey: '<mail-3@example.com>',
        senderName: 'Northwind Careers',
        senderAddress: 'alerts@jobs.example.com',
        subject: 'Jobs 3',
        receivedAt: new Date(SINCE.getTime() + 180_000)
      });
    });

    it('keys an e-mail without a Message-ID by its UIDVALIDITY and UID, and reads the date of the envelope without an arrival time', async () => {
      client.search.mockResolvedValue([5]);
      client.fetchAll.mockResolvedValue([
        message(5, {
          internalDate: undefined,
          envelope: { date: new Date('2026-11-24T00:00:00Z'), from: [{ address: 'alerts@jobs.example.com' }] }
        })
      ]);

      await expect(subjectUnderTest.listHeaders(SINCE, 10)).resolves.toEqual([
        {
          providerId: '7:5',
          messageKey: 'imap:7:5',
          senderName: null,
          senderAddress: 'alerts@jobs.example.com',
          subject: '',
          receivedAt: new Date('2026-11-24T00:00:00Z')
        }
      ]);
    });

    it('fetches nothing when the search finds nothing', async () => {
      client.search.mockResolvedValue([]);

      await expect(subjectUnderTest.listHeaders(SINCE, 10)).resolves.toEqual([]);
      expect(client.fetchAll).not.toHaveBeenCalled();

      client.search.mockResolvedValue(false);

      await expect(subjectUnderTest.listHeaders(SINCE, 10)).resolves.toEqual([]);
    });
  });

  describe('fetchMessage', () => {
    it('fetches the whole message by its UID and parses the MIME parts', async () => {
      client.fetchOne.mockResolvedValue(message(12, { source: Buffer.from(ALERT_SOURCE) }));

      const result = await subjectUnderTest.fetchMessage(headers('7:12'));

      expect(client.fetchOne).toHaveBeenCalledWith('12', { uid: true, source: true }, { uid: true });
      expect(result).toMatchObject({ providerId: '7:12', subject: '2 new jobs for you' });
      expect(result.html).toBe('<a href="https://jobs.example.com/job/7">Backend Developer</a>');
      expect(result.text).toContain('Backend Developer https://jobs.example.com/job/7');
    });

    it('leaves the HTML empty for a plain-text e-mail', async () => {
      const plain = 'From: a@jobs.example.com\r\nSubject: Jobs\r\nContent-Type: text/plain\r\n\r\nNo links here\r\n';

      client.fetchOne.mockResolvedValue(message(12, { source: Buffer.from(plain) }));

      const result = await subjectUnderTest.fetchMessage(headers('7:12'));

      expect(result.html).toBeNull();
      expect(result.text?.trim()).toBe('No links here');
    });

    it('refuses an e-mail the server no longer has', async () => {
      client.fetchOne.mockResolvedValue(false);

      await expect(subjectUnderTest.fetchMessage(headers('7:12'))).rejects.toThrow('JOB_MAIL_MESSAGE_GONE: 7:12');
    });
  });

  describe('close', () => {
    it('logs out once, however often it is called', async () => {
      await subjectUnderTest.close();
      await subjectUnderTest.close();

      expect(client.logout).toHaveBeenCalledTimes(1);
      expect(client.close).not.toHaveBeenCalled();
    });

    it('drops the connection when the logout fails', async () => {
      client.logout.mockRejectedValue(new Error('socket closed'));

      await subjectUnderTest.close();

      expect(client.close).toHaveBeenCalledTimes(1);
    });
  });
});
