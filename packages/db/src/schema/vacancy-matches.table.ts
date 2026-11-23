import { index, integer, jsonb, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';

import type { VacancyMatchVerdictEnum } from '@job-agent/shared';

import { timestampColumns } from '../columns/timestamp.columns.js';
import { resumes } from './resumes.table.js';
import { vacancies } from './vacancies.table.js';

/**
 * Verdict of the matching code for a vacancy against one resume version, with its reasons; a new resume version gets
 * its own rows, so a vacancy is notified once per version
 */
export const vacancyMatches = pgTable(
  'vacancy_matches',
  {
    vacancy_match_id: integer('vacancy_match_id').primaryKey().generatedAlwaysAsIdentity(),
    vacancy_id: integer('vacancy_id')
      .notNull()
      .references(() => vacancies.vacancy_id, { onDelete: 'cascade' }),
    resume_id: integer('resume_id')
      .notNull()
      .references(() => resumes.resume_id, { onDelete: 'cascade' }),
    vacancy_match_verdict: text('vacancy_match_verdict').$type<VacancyMatchVerdictEnum>().notNull(),
    vacancy_match_reasons: jsonb('vacancy_match_reasons').$type<Record<string, unknown>[]>().notNull().default([]),
    vacancy_match_notified_at: timestamp('vacancy_match_notified_at', { withTimezone: true }),
    ...timestampColumns()
  },
  table => [
    unique('vacancy_matches_vacancy_resume_uq').on(table.vacancy_id, table.resume_id),
    index('vacancy_matches_resume_id_idx').on(table.resume_id)
  ]
);
