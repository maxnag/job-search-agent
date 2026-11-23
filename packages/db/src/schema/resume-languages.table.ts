import { integer, pgTable, text, unique } from 'drizzle-orm/pg-core';

import type { LanguageLevelEnum } from '@job-agent/shared';

import { timestampColumns } from '../columns/timestamp.columns.js';
import { resumes } from './resumes.table.js';

/**
 * Spoken languages of a resume version
 */
export const resumeLanguages = pgTable(
  'resume_languages',
  {
    resume_language_id: integer('resume_language_id').primaryKey().generatedAlwaysAsIdentity(),
    resume_id: integer('resume_id')
      .notNull()
      .references(() => resumes.resume_id, { onDelete: 'cascade' }),
    resume_language_code: text('resume_language_code').notNull(),
    resume_language_level: text('resume_language_level').$type<LanguageLevelEnum>().notNull(),
    ...timestampColumns()
  },
  table => [unique('resume_languages_resume_code_uq').on(table.resume_id, table.resume_language_code)]
);
