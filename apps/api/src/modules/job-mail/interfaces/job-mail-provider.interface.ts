import type { JobMailProviderEnum } from '@job-agent/shared';

import type { IJobMailHeaders, IJobMailMessage } from './job-mail-message.interface.js';

/**
 * A mailbox opened for reading only — nothing in it is ever changed, not even the "read" flag
 */
export interface IJobMailbox {
  /**
   * Headers of the e-mails received since the given moment, newest first, at most `limit`
   *
   * @param {Date} since
   * @param {number} limit
   *
   * @returns {Promise<IJobMailHeaders[]>}
   */
  listHeaders(since: Date, limit: number): Promise<IJobMailHeaders[]>;

  /**
   * One e-mail with its body
   *
   * @param {IJobMailHeaders} headers Headers this mailbox listed
   *
   * @returns {Promise<IJobMailMessage>}
   */
  fetchMessage(headers: IJobMailHeaders): Promise<IJobMailMessage>;

  /**
   * Close the connection; safe to call twice
   *
   * @returns {Promise<void>}
   */
  close(): Promise<void>;
}

/**
 * Port of a mail provider: a new kind of mailbox is a new adapter, the pipeline does not change
 */
export interface IJobMailProvider {
  /**
   * The provider the adapter serves
   *
   * @var {JobMailProviderEnum}
   */
  readonly provider: JobMailProviderEnum;

  /**
   * True when the keys the adapter needs are set
   *
   * @returns {boolean}
   */
  isConfigured(): boolean;

  /**
   * Connect and open the mailbox for reading
   *
   * @returns {Promise<IJobMailbox>}
   */
  open(): Promise<IJobMailbox>;
}
