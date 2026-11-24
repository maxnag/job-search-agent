import { z } from 'zod';

/**
 * A posting of the Lever Postings API (`mode=json`); `country` is ISO 3166-1 alpha-2, `workplaceType` is
 * `on-site`, `hybrid`, `remote` or `unspecified`
 */
export const leverPostingSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  hostedUrl: z.string().min(1),
  country: z.string().nullish(),
  workplaceType: z.string().nullish(),
  categories: z
    .object({
      location: z.string().nullish(),
      team: z.string().nullish(),
      department: z.string().nullish(),
      commitment: z.string().nullish(),
      allLocations: z.array(z.string()).nullish()
    })
    .nullish(),
  description: z.string().nullish(),
  lists: z.array(z.object({ text: z.string(), content: z.string() })).nullish(),
  additional: z.string().nullish()
});
