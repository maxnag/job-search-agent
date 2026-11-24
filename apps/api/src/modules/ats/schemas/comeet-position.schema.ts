import { z } from 'zod';

/**
 * A position as a Comeet hosted page embeds it (`COMPANY_POSITIONS_DATA`, `POSITION_DATA`); the description and the
 * requirements are the HTML `custom_fields.details`. `location.is_remote` is not read — it contradicts
 * `workplace_type` on real positions
 */
export const comeetPositionSchema = z.object({
  uid: z.string().min(1),
  name: z.string().min(1),
  department: z.string().nullish(),
  company_name: z.string().nullish(),
  location: z
    .object({
      name: z.string().nullish(),
      country: z.string().nullish(),
      city: z.string().nullish()
    })
    .nullish(),
  workplace_type: z.string().nullish(),
  employment_type: z.string().nullish(),
  experience_level: z.string().nullish(),
  url_comeet_hosted_page: z.string().min(1),
  custom_fields: z
    .object({
      details: z
        .array(
          z.object({
            name: z.string().nullish(),
            value: z.string().nullish()
          })
        )
        .nullish()
    })
    .nullish()
});

/**
 * A validated Comeet position
 */
export type ComeetPositionType = z.infer<typeof comeetPositionSchema>;
