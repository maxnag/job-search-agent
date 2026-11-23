import { z } from 'zod';

import { HebrewRequirementEnum, SeniorityLevelEnum, WorkModeEnum } from '@job-agent/shared';

/**
 * What the LLM extracts from a vacancy page — facts as the page states them, never a judgement of fit
 */
export const vacancyExtractionSchema = z.object({
  is_open: z.boolean(),
  title: z.string().min(1),
  company: z.string().nullable(),
  level: z.enum(SeniorityLevelEnum).nullable(),
  country: z.string().length(2).nullable(),
  city: z.string().nullable(),
  work_mode: z.enum(WorkModeEnum).nullable(),
  programming_languages: z.array(z.object({ name: z.string().min(1), required: z.boolean() })),
  frameworks: z.array(z.string().min(1)),
  years_required: z.number().nonnegative().nullable(),
  hebrew: z.enum(HebrewRequirementEnum),
  summary: z.string()
});

/**
 * Validated answer of the extract step
 */
export type VacancyExtractionType = z.infer<typeof vacancyExtractionSchema>;
