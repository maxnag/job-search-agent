import { integer, jsonb, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';

import type { ATSKindEnum, SourceCandidateStatusEnum } from '@job-agent/shared';

import { timestampColumns } from '../columns/timestamp.columns.js';
import { sources } from './sources.table.js';

/**
 * Company boards on an applicant tracking system found by the discovery and offered to the owner. Every value comes
 * from the board itself — nothing of the web search that led to it is kept. `source_candidate_matching` counts the
 * positions the profiles want, `source_candidate_unknown` the ones whose place is not known well enough to judge.
 * `source_candidate_examples` are a few
 * matching positions for the card, `source_candidate_notified_at` is when its card was queued — a run offers only a
 * few boards. `source_id` is set once the owner adds the board as a source
 */
export const sourceCandidates = pgTable(
  'source_candidates',
  {
    source_candidate_id: integer('source_candidate_id').primaryKey().generatedAlwaysAsIdentity(),
    source_candidate_ats_kind: text('source_candidate_ats_kind').$type<ATSKindEnum>().notNull(),
    source_candidate_board: text('source_candidate_board').notNull(),
    source_candidate_company: text('source_candidate_company').notNull(),
    source_candidate_status: text('source_candidate_status').$type<SourceCandidateStatusEnum>().notNull(),
    source_candidate_positions: integer('source_candidate_positions').notNull().default(0),
    source_candidate_matching: integer('source_candidate_matching').notNull().default(0),
    source_candidate_unknown: integer('source_candidate_unknown').notNull().default(0),
    source_candidate_examples: jsonb('source_candidate_examples').$type<string[]>().notNull().default([]),
    source_candidate_checked_at: timestamp('source_candidate_checked_at', { withTimezone: true }).notNull().defaultNow(),
    source_candidate_notified_at: timestamp('source_candidate_notified_at', { withTimezone: true }),
    source_id: integer('source_id').references(() => sources.source_id, { onDelete: 'set null' }),
    ...timestampColumns()
  },
  table => [unique('source_candidates_ats_kind_board_uq').on(table.source_candidate_ats_kind, table.source_candidate_board)]
);
