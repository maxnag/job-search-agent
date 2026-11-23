import { boolean, integer, pgTable, real, text, unique } from 'drizzle-orm/pg-core';

import type { SkillKindEnum } from '@job-agent/shared';

import { timestampColumns } from '../columns/timestamp.columns.js';
import { resumes } from './resumes.table.js';

/**
 * Skills of a resume version, keyed by the skill dictionary; `claimed` — stated in the summary or skills section,
 * not only named in the stack of a job; `hidden` — the owner's switch: a hidden skill takes no part in the search
 */
export const resumeSkills = pgTable(
  'resume_skills',
  {
    resume_skill_id: integer('resume_skill_id').primaryKey().generatedAlwaysAsIdentity(),
    resume_id: integer('resume_id')
      .notNull()
      .references(() => resumes.resume_id, { onDelete: 'cascade' }),
    resume_skill_key: text('resume_skill_key').notNull(),
    resume_skill_name: text('resume_skill_name').notNull(),
    resume_skill_kind: text('resume_skill_kind').$type<SkillKindEnum>().notNull(),
    resume_skill_years: real('resume_skill_years'),
    resume_skill_is_unknown: boolean('resume_skill_is_unknown').notNull().default(false),
    resume_skill_is_claimed: boolean('resume_skill_is_claimed').notNull().default(false),
    resume_skill_is_hidden: boolean('resume_skill_is_hidden').notNull().default(false),
    ...timestampColumns()
  },
  table => [unique('resume_skills_resume_key_uq').on(table.resume_id, table.resume_skill_key)]
);
