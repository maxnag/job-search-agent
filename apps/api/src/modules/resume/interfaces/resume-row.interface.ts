import type { InferSelectModel } from 'drizzle-orm';

import type { resumes } from '@job-agent/db';

/**
 * A row of `resumes`
 */
export type ResumeRowType = InferSelectModel<typeof resumes>;
