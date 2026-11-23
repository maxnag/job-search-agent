import { boolean, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import { SourceFetchModeEnum, SourceStatusEnum } from '@job-agent/shared';

import { timestampColumns } from '../columns/timestamp.columns.js';

/**
 * Career pages of companies, added by hand; the URL may carry the filters of the site. `source_is_active` is the
 * owner's switch, `source_status` is set by the crawler
 */
export const sources = pgTable('sources', {
  source_id: integer('source_id').primaryKey().generatedAlwaysAsIdentity(),
  source_name: text('source_name').notNull(),
  source_url: text('source_url').notNull().unique('sources_source_url_uq'),
  source_fetch_mode: text('source_fetch_mode').$type<SourceFetchModeEnum>().notNull().default(SourceFetchModeEnum.HTML),
  source_is_active: boolean('source_is_active').notNull().default(true),
  source_status: text('source_status').$type<SourceStatusEnum>().notNull().default(SourceStatusEnum.OK),
  source_last_scan_at: timestamp('source_last_scan_at', { withTimezone: true }),
  source_last_error: text('source_last_error'),
  ...timestampColumns()
});
