import { index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import type { JobMailKindEnum, JobMailMessageStatusEnum, JobMailProviderEnum } from '@job-agent/shared';

import { timestampColumns } from '../columns/timestamp.columns.js';
import { sources } from './sources.table.js';

/**
 * E-mails read from the mailbox, one row each, so none is read twice. `job_mail_message_key` is the `Message-ID` header —
 * the same under any provider —, `<provider>:<provider id>` for an e-mail without one. Only what the pipeline needs is
 * kept: never a subject, a body or an address, only the domain of the sender. `source_id` is the source of the sender
 * domain for a job alert, null for any other kind; the counters are the links, the positions the LLM picked and the
 * vacancies created; `job_mail_message_error` is the code of the failure of a `failed` one
 */
export const jobMailMessages = pgTable(
  'job_mail_messages',
  {
    job_mail_message_id: integer('job_mail_message_id').primaryKey().generatedAlwaysAsIdentity(),
    source_id: integer('source_id').references(() => sources.source_id, { onDelete: 'set null' }),
    job_mail_message_key: text('job_mail_message_key').notNull().unique('job_mail_messages_key_uq'),
    job_mail_message_provider: text('job_mail_message_provider').$type<JobMailProviderEnum>().notNull(),
    job_mail_message_provider_id: text('job_mail_message_provider_id').notNull(),
    job_mail_message_sender_domain: text('job_mail_message_sender_domain').notNull(),
    job_mail_message_received_at: timestamp('job_mail_message_received_at', { withTimezone: true }).notNull(),
    job_mail_message_kind: text('job_mail_message_kind').$type<JobMailKindEnum>().notNull(),
    job_mail_message_status: text('job_mail_message_status').$type<JobMailMessageStatusEnum>().notNull(),
    job_mail_message_links: integer('job_mail_message_links').notNull().default(0),
    job_mail_message_positions: integer('job_mail_message_positions').notNull().default(0),
    job_mail_message_created: integer('job_mail_message_created').notNull().default(0),
    job_mail_message_error: text('job_mail_message_error'),
    ...timestampColumns()
  },
  table => [index('job_mail_messages_received_at_idx').on(table.job_mail_message_received_at)]
);
