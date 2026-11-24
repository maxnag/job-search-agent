import { index, integer, jsonb, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';

import { type RoleFamilyEnum, type SeniorityLevelEnum, VacancyStageEnum, type WorkModeEnum } from '@job-agent/shared';

import { timestampColumns } from '../columns/timestamp.columns.js';
import { sources } from './sources.table.js';

/**
 * Vacancies seen on the listing pages. One vacancy found in two places is one row: the URL is unique, and so is the
 * normalized `company + title` key within a country — `vacancy_dedup_country` is the country known when the vacancy
 * was first listed, empty when none was, and never changes; the same title in two countries is two vacancies.
 * `vacancy_data` is the extraction of its page, `vacancy_text_hash` tells a
 * changed page from the same one, `vacancy_checked_at` is when its page was last read. `vacancy_external_id` is the id
 * of the position in the applicant tracking system of an `ats` source, null for other sources. A vacancy from a job
 * mail whose `vacancy_url` is never opened (LinkedIn, Glassdoor) is read from `vacancy_text_url` — the same position on
 * the board of the company, found by a web search; `vacancy_text_searched_at` and `vacancy_text_searches` are when and
 * how many times that search ran
 */
export const vacancies = pgTable(
  'vacancies',
  {
    vacancy_id: integer('vacancy_id').primaryKey().generatedAlwaysAsIdentity(),
    source_id: integer('source_id')
      .notNull()
      .references(() => sources.source_id),
    vacancy_url: text('vacancy_url').notNull().unique('vacancies_vacancy_url_uq'),
    vacancy_external_id: text('vacancy_external_id'),
    vacancy_title: text('vacancy_title').notNull(),
    vacancy_company: text('vacancy_company').notNull(),
    vacancy_dedup_key: text('vacancy_dedup_key').notNull(),
    vacancy_dedup_country: text('vacancy_dedup_country').notNull().default(''),
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
    vacancy_text_url: text('vacancy_text_url'),
    vacancy_text_searched_at: timestamp('vacancy_text_searched_at', { withTimezone: true }),
    vacancy_text_searches: integer('vacancy_text_searches').notNull().default(0),
    ...timestampColumns()
  },
  table => [
    index('vacancies_source_id_idx').on(table.source_id),
    unique('vacancies_dedup_key_country_uq').on(table.vacancy_dedup_key, table.vacancy_dedup_country)
  ]
);
