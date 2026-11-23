import { sql } from 'drizzle-orm';
import { boolean, integer, jsonb, pgTable, real, text, unique, uniqueIndex } from 'drizzle-orm/pg-core';

import { timestampColumns } from '../columns/timestamp.columns.js';
import { profiles } from './profiles.table.js';

/**
 * Versions of the resume of a profile; exactly one per profile is current
 */
export const resumes = pgTable(
  'resumes',
  {
    resume_id: integer('resume_id').primaryKey().generatedAlwaysAsIdentity(),
    profile_id: integer('profile_id')
      .notNull()
      .references(() => profiles.profile_id, { onDelete: 'cascade' }),
    resume_file_name: text('resume_file_name').notNull(),
    resume_file_hash: text('resume_file_hash').notNull(),
    resume_file_path: text('resume_file_path'),
    resume_text: text('resume_text').notNull(),
    resume_data: jsonb('resume_data').$type<Record<string, unknown>>().notNull(),
    resume_experience_years: real('resume_experience_years'),
    resume_llm_model: text('resume_llm_model').notNull(),
    resume_is_current: boolean('resume_is_current').notNull().default(false),
    ...timestampColumns()
  },
  table => [
    unique('resumes_profile_file_hash_uq').on(table.profile_id, table.resume_file_hash),
    uniqueIndex('resumes_profile_current_uq')
      .on(table.profile_id)
      .where(sql`${table.resume_is_current}`)
  ]
);
