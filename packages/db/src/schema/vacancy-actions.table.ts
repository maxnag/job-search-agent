import { index, integer, pgTable, text } from 'drizzle-orm/pg-core';

import type { VacancyActionKindEnum } from '@job-agent/shared';

import { timestampColumns } from '../columns/timestamp.columns.js';
import { vacancies } from './vacancies.table.js';

/**
 * Buttons the owner pressed under the vacancy cards in Telegram — the history of choices, used to tune the filters
 */
export const vacancyActions = pgTable(
  'vacancy_actions',
  {
    vacancy_action_id: integer('vacancy_action_id').primaryKey().generatedAlwaysAsIdentity(),
    vacancy_id: integer('vacancy_id')
      .notNull()
      .references(() => vacancies.vacancy_id, { onDelete: 'cascade' }),
    vacancy_action_kind: text('vacancy_action_kind').$type<VacancyActionKindEnum>().notNull(),
    vacancy_action_message_id: integer('vacancy_action_message_id').notNull(),
    ...timestampColumns()
  },
  table => [index('vacancy_actions_vacancy_id_idx').on(table.vacancy_id)]
);
