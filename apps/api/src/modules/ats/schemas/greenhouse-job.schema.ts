import { z } from 'zod';

/**
 * A job of the Greenhouse Job Board API — in the list, and with `content=true` or alone, with its description
 * (HTML escaped as entities), departments and offices
 */
export const greenhouseJobSchema = z.object({
  id: z.number().int(),
  title: z.string().min(1),
  absolute_url: z.string().min(1),
  company_name: z.string().nullish(),
  location: z.object({ name: z.string().nullish() }).nullish(),
  content: z.string().nullish(),
  departments: z.array(z.object({ name: z.string() })).nullish(),
  offices: z.array(z.object({ name: z.string() })).nullish()
});

/**
 * A validated Greenhouse job
 */
export type GreenhouseJobType = z.infer<typeof greenhouseJobSchema>;
