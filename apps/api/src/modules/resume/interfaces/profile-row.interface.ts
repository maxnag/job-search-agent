import type { InferSelectModel } from 'drizzle-orm';

import type { profiles } from '@job-agent/db';

/**
 * A row of `profiles`
 */
export type ProfileRowType = InferSelectModel<typeof profiles>;
