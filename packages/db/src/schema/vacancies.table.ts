import { index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import { type RoleFamilyEnum, type SeniorityLevelEnum, VacancyStageEnum, type WorkModeEnum } from '@job-agent/shared';

import { timestampColumns } from '../columns/timestamp.columns.js';
import { sources } from './sources.table.js';

/**
 * Vacancies seen on the listing pages. One vacancy found in two places is one row: the URL and the normalized
 * `company + title` key are both unique. `vacancy_data` is the extraction of its page, `vacancy_text_hash` tells a
 * changed page from the same one, `vacancy_checked_at` is when its page was last read
 */
export const vacancies = pgTable(
  'vacancies',
  {
    vacancy_id: integer('vacancy_id').primaryKey().generatedAlwaysAsIdentity(),
    source_id: integer('source_id')
      .notNull()
      .references(() => sources.source_id),
    vacancy_url: text('vacancy_url').notNull().unique('vacancies_vacancy_url_uq'),
    vacancy_title: text('vacancy_title').notNull(),
    vacancy_company: text('vacancy_company').notNull(),
    vacancy_dedup_key: text('vacancy_dedup_key').notNull().unique('vacancies_vacancy_dedup_key_uq'),
    vacancy_country: text('vacancy_country'),
    vacancy_city: text('vacancy_city'),
    vacancy_work_mode: text('vacancy_work_mode').$type<WorkModeEnum>(),
    vacancy_role_family: text('vacancy_role_family').$type<RoleFamilyEnum>(),
    vacancy_level: text('vacancy_level').$type<SeniorityLevelEnum>(),
    vacancy_stage: text('vacancy_stage').$type<VacancyStageEnum>().notNull().default(VacancyStageEnum.LISTED),
    vacancy_skip_reason: text('vacancy_skip_reason'),
    vacancy_text_hash: text('vacancy_text_hash'),
    vacancy_data: jsonb('vacancy_data').$type<Record<string, unknown>>(),
    vacancy_first_seen_at: timestamp('vacancy_first_seen_at', { withTimezone: true }).notNull().defaultNow(),
    vacancy_last_seen_at: timestamp('vacancy_last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    vacancy_closed_at: timestamp('vacancy_closed_at', { withTimezone: true }),
    vacancy_checked_at: timestamp('vacancy_checked_at', { withTimezone: true }),
    ...timestampColumns()
  },
  table => [index('vacancies_source_id_idx').on(table.source_id)]
);
