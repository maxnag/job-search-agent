import type { InferInsertModel } from 'drizzle-orm';

import type { jobMailMessages } from '@job-agent/db';

/**
 * Values of a new row of `job_mail_messages`
 */
export type JobMailMessageInsertType = InferInsertModel<typeof jobMailMessages>;
