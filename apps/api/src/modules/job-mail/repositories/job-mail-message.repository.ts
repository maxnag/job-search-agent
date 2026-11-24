import { Injectable } from '@nestjs/common';
import { inArray } from 'drizzle-orm';

import { jobMailMessages } from '@job-agent/db';

import { DatabaseService } from '../../database/services/database.service.js';
import type { JobMailMessageInsertType } from '../interfaces/job-mail-message-row.interface.js';

/**
 * Data access of the e-mails already read
 */
@Injectable()
export class JobMailMessageRepository {
  /**
   * @param {DatabaseService} databaseService
   */
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * The keys among the given ones of e-mails already read
   *
   * @param {readonly string[]} keys
   *
   * @returns {Promise<Set<string>>}
   */
  async findKnownKeys(keys: readonly string[]): Promise<Set<string>> {
    if (keys.length === 0) {
      return new Set();
    }

    const rows = await this.databaseService.db
      .select({ key: jobMailMessages.job_mail_message_key })
      .from(jobMailMessages)
      .where(inArray(jobMailMessages.job_mail_message_key, [...keys]));

    return new Set(rows.map(row => row.key));
  }

  /**
   * Record e-mails read; one recorded meanwhile is left as it is
   *
   * @param {readonly JobMailMessageInsertType[]} rows
   *
   * @returns {Promise<void>}
   */
  async create(rows: readonly JobMailMessageInsertType[]): Promise<void> {
    if (rows.length === 0) {
      return;
    }

    await this.databaseService.db
      .insert(jobMailMessages)
      .values([...rows])
      .onConflictDoNothing();
  }
}
