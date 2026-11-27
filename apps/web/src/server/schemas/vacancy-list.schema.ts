import { z } from 'zod';

import {
  type IVacancyListPage,
  SeniorityLevelEnum,
  VacancyActionKindEnum,
  VacancyMatchVerdictEnum,
  VacancyStageEnum,
  WorkModeEnum
} from '@job-agent/shared';

/**
 * Answer of `GET /api/vacancies` — one page of the list
 */
export const vacancyListSchema = z.object({
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  vacancies: z.array(
    z.object({
      vacancyId: z.number().int(),
      title: z.string(),
      company: z.string(),
      city: z.string().nullable(),
      country: z.string().nullable(),
      workMode: z.enum(WorkModeEnum).nullable(),
      level: z.enum(SeniorityLevelEnum).nullable(),
      stage: z.enum(VacancyStageEnum),
      source: z.string(),
      firstSeenAt: z.string(),
      lastAction: z.enum(VacancyActionKindEnum).nullable(),
      verdicts: z.array(z.object({ profile: z.string(), verdict: z.enum(VacancyMatchVerdictEnum), findings: z.array(z.string()) }))
    })
  )
}) satisfies z.ZodType<IVacancyListPage>;

/**
 * Validated answer of `GET /api/vacancies`
 */
export type VacancyListType = z.infer<typeof vacancyListSchema>;
