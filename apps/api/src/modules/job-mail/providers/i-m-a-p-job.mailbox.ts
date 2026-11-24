import type { FetchMessageObject, ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

import { JobMailProviderEnum } from '@job-agent/shared';

import { jobMailMessageKey } from '../helpers/job-mail-address.helper.js';
import type { IJobMailHeaders, IJobMailMessage } from '../interfaces/job-mail-message.interface.js';
import type { IJobMailbox } from '../interfaces/job-mail-provider.interface.js';

/**
 * Milliseconds in a day — the server searches by date, so the search starts a day early and code cuts the hours
 *
 * @type {number}
 */
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Separator of the `UIDVALIDITY` and the `UID` in a provider id
 *
 * @type {string}
 */
const PROVIDER_ID_SEPARATOR = ':';

/**
 * A mailbox folder opened by `EXAMINE` over IMAP. Read only by construction: the folder is never `SELECT`ed, every
 * header and body is fetched by `BODY.PEEK` (no `\Seen` flag), and no command that changes the mailbox exists here
 */
export class IMAPJobMailbox implements IJobMailbox {
  /**
   * True once the connection is closed
   *
   * @var {boolean}
   */
  private closed = false;

  /**
   * @param {ImapFlow} client Connected client with the folder opened read-only
   * @param {bigint} uidValidity `UIDVALIDITY` of the folder — a UID means the same e-mail only under it
   */
  constructor(
    private readonly client: ImapFlow,
    private readonly uidValidity: bigint
  ) {}

  /**
   * Headers of the e-mails received since the given moment, newest first, at most `limit`
   *
   * @param {Date} since
   * @param {number} limit
   *
   * @returns {Promise<IJobMailHeaders[]>}
   */
  async listHeaders(since: Date, limit: number): Promise<IJobMailHeaders[]> {
    const uids = await this.client.search({ since: new Date(since.getTime() - DAY_MS) }, { uid: true });

    if (!uids || uids.length === 0) {
      return [];
    }

    const messages = await this.client.fetchAll(uids.join(','), { uid: true, envelope: true, internalDate: true }, { uid: true });

    return messages
      .map(message => this.toHeaders(message))
      .filter(headers => headers.receivedAt >= since)
      .sort((left, right) => right.receivedAt.getTime() - left.receivedAt.getTime())
      .slice(0, limit);
  }

  /**
   * One e-mail with its body
   *
   * @param {IJobMailHeaders} headers
   *
   * @throws {Error} `JOB_MAIL_MESSAGE_GONE` if the folder no longer has the e-mail
   *
   * @returns {Promise<IJobMailMessage>}
   */
  async fetchMessage(headers: IJobMailHeaders): Promise<IJobMailMessage> {
    const uid = headers.providerId.split(PROVIDER_ID_SEPARATOR).at(-1) ?? '';
    const message = await this.client.fetchOne(uid, { uid: true, source: true }, { uid: true });

    if (!message || !message.source) {
      throw new Error(`JOB_MAIL_MESSAGE_GONE: ${headers.providerId}`);
    }

    const parsed = await simpleParser(message.source, { skipImageLinks: true, skipTextToHtml: true });

    return { ...headers, html: parsed.html || null, text: parsed.text || null };
  }

  /**
   * Close the connection; safe to call twice
   *
   * @returns {Promise<void>}
   */
  async close(): Promise<void> {
    if (this.closed) {
      return;
    }

    this.closed = true;

    try {
      await this.client.logout();
    } catch {
      this.client.close();
    }
  }

  /**
   * Headers of a fetched e-mail
   *
   * @param {FetchMessageObject} message
   *
   * @returns {IJobMailHeaders}
   */
  private toHeaders(message: FetchMessageObject): IJobMailHeaders {
    const providerId = `${this.uidValidity}${PROVIDER_ID_SEPARATOR}${message.uid}`;
    const sender = message.envelope?.from?.[0];
    const received = message.internalDate ?? message.envelope?.date;

    return {
      providerId,
      messageKey: jobMailMessageKey(message.envelope?.messageId, JobMailProviderEnum.IMAP, providerId),
      senderName: sender?.name?.trim() || null,
      senderAddress: sender?.address?.trim().toLowerCase() ?? '',
      subject: message.envelope?.subject?.trim() ?? '',
      receivedAt: received ? new Date(received) : new Date(0)
    };
  }
}
