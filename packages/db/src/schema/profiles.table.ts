import { sql } from 'drizzle-orm';
import { integer, pgTable, text } from 'drizzle-orm/pg-core';

import { SkillKindEnum } from '@job-agent/shared';

import { timestampColumns } from '../columns/timestamp.columns.js';

/**
 * A search profile — one per kind of resume (developer, cook …); its current resume version is the source of truth
 */
export const profiles = pgTable('profiles', {
  profile_id: integer('profile_id').primaryKey().generatedAlwaysAsIdentity(),
  profile_name: text('profile_name').notNull().unique('profiles_profile_name_uq'),
  profile_core_skill_kinds: text('profile_core_skill_kinds')
    .array()
    .$type<SkillKindEnum[]>()
    .notNull()
    .default(sql`ARRAY['${sql.raw(SkillKindEnum.PROGRAMMING_LANGUAGE)}']::text[]`),
  ...timestampColumns()
});
