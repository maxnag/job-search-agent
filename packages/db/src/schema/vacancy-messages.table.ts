import { integer, pgTable, unique } from 'drizzle-orm/pg-core';

import { timestampColumns } from '../columns/timestamp.columns.js';
import { vacancies } from './vacancies.table.js';

/**
 * Telegram messages that carry the action buttons of a vacancy — its card and the notice of a change. A choice made
 * anywhere is shown under each of them
 */
export const vacancyMessages = pgTable(
  'vacancy_messages',
  {
    vacancy_message_id: integer('vacancy_message_id').primaryKey().generatedAlwaysAsIdentity(),
    vacancy_id: integer('vacancy_id')
      .notNull()
      .references(() => vacancies.vacancy_id, { onDelete: 'cascade' }),
    vacancy_message_telegram_id: integer('vacancy_message_telegram_id').notNull(),
    ...timestampColumns()
  },
  table => [unique('vacancy_messages_vacancy_telegram_uq').on(table.vacancy_id, table.vacancy_message_telegram_id)]
);
