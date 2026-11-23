import type { InferSelectModel } from 'drizzle-orm';

import type { sources } from '@job-agent/db';

/**
 * A row of `sources`
 */
export type SourceRowType = InferSelectModel<typeof sources>;
