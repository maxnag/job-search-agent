import { z } from 'zod';

import { RoleFamilyEnum, SeniorityLevelEnum, WorkModeEnum } from '@job-agent/shared';

/**
 * What a profile searches for, edited by hand in `profiles.profile_preferences`. An empty list means «no limit»
 */
export const profilePreferencesSchema = z.object({
  role_families: z.array(z.enum(RoleFamilyEnum)).default([]),
  min_level: z.enum(SeniorityLevelEnum).optional(),
  places: z
    .array(
      z.object({
        country: z
          .string()
          .length(2)
          .transform(code => code.toUpperCase()),
        work_modes: z.array(z.enum(WorkModeEnum)).min(1),
        excluded_cities: z.array(z.string().min(1)).default([])
      })
    )
    .default([]),
  excluded_companies: z.array(z.string().min(1)).default([])
});

/**
 * Validated preferences of a profile
 */
export type ProfilePreferencesType = z.infer<typeof profilePreferencesSchema>;
