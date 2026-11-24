import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ImapFlow } from 'imapflow';

import { JobMailProviderEnum } from '@job-agent/shared';

import type { IEnv } from '../../../config/env.schema.js';
import type { IJobMailProvider } from '../interfaces/job-mail-provider.interface.js';
import { IMAPJobMailbox } from './i-m-a-p-job.mailbox.js';

/**
 * A mailbox over IMAP with a password — an app password of Gmail. The host, port, folder and account come from the
 * environment; nothing here knows Gmail. The connection is TLS only and the folder is opened by `EXAMINE`
 */
@Injectable()
export class IMAPJobMailProvider implements IJobMailProvider {
  /**
   * The provider the adapter serves
   *
   * @var {JobMailProviderEnum}
   */
  readonly provider = JobMailProviderEnum.IMAP;

  /**
   * Logger
   *
   * @var {Logger}
   */
  private readonly logger = new Logger(IMAPJobMailProvider.name);

  /**
   * @param {ConfigService<IEnv, true>} configService
   */
  constructor(private readonly configService: ConfigService<IEnv, true>) {}

  /**
   * True when the account and its password are set
   *
   * @returns {boolean}
   */
  isConfigured(): boolean {
    return Boolean(
      this.configService.get('JOB_MAIL_IMAP_USER', { infer: true }) && this.configService.get('JOB_MAIL_IMAP_PASSWORD', { infer: true })
    );
  }

  /**
   * Connect and open the folder `JOB_MAIL_IMAP_MAILBOX` read-only
   *
   * @throws {Error} `JOB_MAIL_NOT_CONFIGURED` if the account or the password is not set
   * @throws {Error} `JOB_MAIL_AUTH_FAILED` if the server refuses the account or the password — a retry would not help
   * @throws {Error} `JOB_MAIL_CONNECTION_FAILED` if the server was not reached or the folder not opened
   *
   * @returns {Promise<IMAPJobMailbox>}
   */
  async open(): Promise<IMAPJobMailbox> {
    const user = this.configService.get('JOB_MAIL_IMAP_USER', { infer: true });
    const pass = this.configService.get('JOB_MAIL_IMAP_PASSWORD', { infer: true });

    if (!user || !pass) {
      throw new Error('JOB_MAIL_NOT_CONFIGURED: set JOB_MAIL_IMAP_USER and JOB_MAIL_IMAP_PASSWORD in .env');
    }

    const timeoutMs = this.configService.get('JOB_MAIL_TIMEOUT_MS', { infer: true });
    const client = new ImapFlow({
      host: this.configService.get('JOB_MAIL_IMAP_HOST', { infer: true }),
      port: this.configService.get('JOB_MAIL_IMAP_PORT', { infer: true }),
      secure: true,
      auth: { user, pass: pass.replace(/\s+/g, '') },
      logger: false,
      disableAutoIdle: true,
      connectionTimeout: timeoutMs,
      greetingTimeout: timeoutMs,
      socketTimeout: timeoutMs
    });

    client.on('error', (error: Error) => {
      this.logger.warn({ message: 'IMAP connection error', reason: error.message });
    });

    try {
      await client.connect();
    } catch (error) {
      client.close();

      if ((error as { authenticationFailed?: boolean }).authenticationFailed) {
        throw new Error('JOB_MAIL_AUTH_FAILED: the server refused the account or its app password', { cause: error });
      }

      throw new Error(`JOB_MAIL_CONNECTION_FAILED: ${(error as Error).message}`, { cause: error });
    }

    const jobMailbox = this.configService.get('JOB_MAIL_IMAP_MAILBOX', { infer: true });

    try {
      const folder = await client.mailboxOpen(jobMailbox, { readOnly: true });

      return new IMAPJobMailbox(client, folder.uidValidity);
    } catch (error) {
      await new IMAPJobMailbox(client, 0n).close();

      throw new Error(`JOB_MAIL_CONNECTION_FAILED: folder "${jobMailbox}" not opened — ${(error as Error).message}`, { cause: error });
    }
  }
}
