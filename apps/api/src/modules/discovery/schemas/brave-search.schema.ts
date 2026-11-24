import { z } from 'zod';

/**
 * The part of a Brave Web Search answer the discovery reads: the URLs of the web results — never their titles or
 * snippets
 */
export const braveSearchSchema = z.object({
  web: z
    .object({
      results: z.array(z.object({ url: z.string() })).default([])
    })
    .optional()
});
