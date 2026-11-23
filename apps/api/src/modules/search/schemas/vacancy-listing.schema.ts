import { z } from 'zod';

import { RoleFamilyEnum, SeniorityLevelEnum, WorkModeEnum } from '@job-agent/shared';

/**
 * What the LLM returns for a listing page: only the links that are single vacancies, each by its number in the
 * prompt, classified from the title and the text around it — never judged
 */
export const vacancyListingSchema = z.object({
  positions: z.array(
    z.object({
      link: z.number().int().nonnegative(),
      title: z.string().min(1),
      company: z.string().nullable(),
      country: z.string().length(2).nullable(),
      city: z.string().nullable(),
      work_mode: z.enum(WorkModeEnum).nullable(),
      role_family: z.enum(RoleFamilyEnum),
      level: z.enum(SeniorityLevelEnum).nullable()
    })
  )
});

/**
 * Validated answer of the listing step
 */
export type VacancyListingType = z.infer<typeof vacancyListingSchema>;
