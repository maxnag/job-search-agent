import { z } from 'zod';

import { JobMailKindEnum } from '@job-agent/shared';

/**
 * What the LLM returns for a list of e-mail headers: the kind of each e-mail by its number in the prompt
 */
export const jobMailTriageSchema = z.object({
  mails: z.array(
    z.object({
      mail: z.number().int().nonnegative(),
      kind: z.enum(JobMailKindEnum)
    })
  )
});
