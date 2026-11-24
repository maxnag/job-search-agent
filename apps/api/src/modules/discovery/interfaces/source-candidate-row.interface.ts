import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';

import type { sourceCandidates } from '@job-agent/db';

/**
 * A row of `source_candidates`
 */
export type SourceCandidateRowType = InferSelectModel<typeof sourceCandidates>;

/**
 * A new or re-checked row of `source_candidates`
 */
export type SourceCandidateInsertType = InferInsertModel<typeof sourceCandidates>;
