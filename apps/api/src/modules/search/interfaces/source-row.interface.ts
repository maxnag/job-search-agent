import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';

import type { sources } from '@job-agent/db';

/**
 * A row of `sources`
 */
export type SourceRowType = InferSelectModel<typeof sources>;

/**
 * A new row of `sources`
 */
export type SourceInsertType = InferInsertModel<typeof sources>;
