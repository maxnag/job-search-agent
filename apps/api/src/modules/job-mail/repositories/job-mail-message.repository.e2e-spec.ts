import { Test, type TestingModule } from '@nestjs/testing';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { jobMailMessages, sources, truncateTables } from '@job-agent/db';
import { JobMailKindEnum, JobMailMessageStatusEnum, JobMailProviderEnum } from '@job-agent/shared';

import { testDatabaseProvider } from '../../../../test/test-database.provider.js';
import { insertSource } from '../../../../test/vacancy-fixtures.js';
import { DatabaseService } from '../../database/services/database.service.js';
import type { JobMailMessageInsertType } from '../interfaces/job-mail-message-row.interface.js';
import { JobMailMessageRepository } from './job-mail-message.repository.js';

/**
 * Row of a fictional e-mail
 *
 * @param {string} key
 * @param {Partial<JobMailMessageInsertType>} changes
 *
 * @returns {JobMailMessageInsertType}
 */
function row(key: string, changes: Partial<JobMailMessageInsertType> = {}): JobMailMessageInsertType {
  return {
    job_mail_message_key: key,
    job_mail_message_provider: JobMailProviderEnum.IMAP,
    job_mail_message_provider_id: `7:${key.length}`,
    job_mail_message_sender_domain: 'jobs.example.com',
    job_mail_message_received_at: new Date('2026-11-24T08:00:00Z'),
    job_mail_message_kind: JobMailKindEnum.OTHER,
    job_mail_message_status: JobMailMessageStatusEnum.IGNORED,
    ...changes
  };
}

describe('JobMailMessageRepository (e2e)', () => {
  let moduleFixture: TestingModule;
  let repository: JobMailMessageRepository;
  let database: DatabaseService;

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({ providers: [JobMailMessageRepository, testDatabaseProvider()] }).compile();
    repository = moduleFixture.get(JobMailMessageRepository);
    database = moduleFixture.get(DatabaseService);
  });

  beforeEach(async () => {
    await truncateTables(database.db, [jobMailMessages, sources]);
  });

  afterAll(async () => {
    await moduleFixture.close();
  });

  it('stores the e-mails read and tells which keys it knows', async () => {
    const source = await insertSource(database, { source_url: 'mailto:@jobs.example.com' });

    await repository.create([
      row('<a@example.com>'),
      row('<b@example.com>', {
        source_id: source.source_id,
        job_mail_message_kind: JobMailKindEnum.JOB_ALERT,
        job_mail_message_status: JobMailMessageStatusEnum.PROCESSED,
        job_mail_message_links: 4,
        job_mail_message_positions: 4,
        job_mail_message_created: 2
      })
    ]);

    await expect(repository.findKnownKeys(['<a@example.com>', '<b@example.com>', '<c@example.com>'])).resolves.toEqual(
      new Set(['<a@example.com>', '<b@example.com>'])
    );

    const [alert] = await database.db.select().from(jobMailMessages).where(eq(jobMailMessages.job_mail_message_key, '<b@example.com>'));

    expect(alert).toMatchObject({
      source_id: source.source_id,
      job_mail_message_status: JobMailMessageStatusEnum.PROCESSED,
      job_mail_message_created: 2,
      job_mail_message_error: null,
      dt_update: null
    });
  });

  it('keeps the first row of an e-mail recorded twice', async () => {
    await repository.create([row('<a@example.com>')]);
    await repository.create([row('<a@example.com>', { job_mail_message_status: JobMailMessageStatusEnum.FAILED })]);

    const rows = await database.db.select().from(jobMailMessages);

    expect(rows.map(item => item.job_mail_message_status)).toEqual([JobMailMessageStatusEnum.IGNORED]);
  });

  it('keeps the row of an e-mail when its source is deleted', async () => {
    const source = await insertSource(database, { source_url: 'mailto:@jobs.example.com' });

    await repository.create([row('<a@example.com>', { source_id: source.source_id })]);
    await database.db.delete(sources).where(eq(sources.source_id, source.source_id));

    await expect(repository.findKnownKeys(['<a@example.com>'])).resolves.toEqual(new Set(['<a@example.com>']));
    await expect(database.db.select({ sourceId: jobMailMessages.source_id }).from(jobMailMessages)).resolves.toEqual([{ sourceId: null }]);
  });

  it('asks the database nothing for no keys and no rows', async () => {
    await expect(repository.findKnownKeys([])).resolves.toEqual(new Set());
    await expect(repository.create([])).resolves.toBeUndefined();
  });
});
