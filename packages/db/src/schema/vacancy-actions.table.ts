import { index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import type { VacancyActionKindEnum } from '@job-agent/shared';

import { timestampColumns } from '../columns/timestamp.columns.js';
import { vacancies } from './vacancies.table.js';

/**
 * Choices the owner made about a vacancy — a button under its card in Telegram, or a call of the `record_action` tool of
 * the MCP server or the web UI, which have no message (`vacancy_action_message_id` is null). `vacancy_action_synced_at` is
 * set once the choice is shown under every Telegram message of the vacancy. The history of choices tunes the filters
 */
export const vacancyActions = pgTable(
  'vacancy_actions',
  {
    vacancy_action_id: integer('vacancy_action_id').primaryKey().generatedAlwaysAsIdentity(),
    vacancy_id: integer('vacancy_id')
      .notNull()
      .references(() => vacancies.vacancy_id, { onDelete: 'cascade' }),
    vacancy_action_kind: text('vacancy_action_kind').$type<VacancyActionKindEnum>().notNull(),
    vacancy_action_message_id: integer('vacancy_action_message_id'),
    vacancy_action_synced_at: timestamp('vacancy_action_synced_at', { withTimezone: true }),
    ...timestampColumns()
  },
  table => [index('vacancy_actions_vacancy_id_idx').on(table.vacancy_id)]
);
