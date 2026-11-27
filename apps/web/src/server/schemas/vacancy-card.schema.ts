import { z } from 'zod';

import {
  HebrewRequirementEnum,
  type IVacancyCard,
  SeniorityLevelEnum,
  VacancyActionKindEnum,
  VacancyMatchVerdictEnum,
  VacancyStageEnum,
  WorkModeEnum
} from '@job-agent/shared';

/**
 * Answer of `GET /api/vacancies/:id` — a vacancy with everything known about it
 */
export const vacancyCardSchema = z.object({
  vacancyId: z.number().int(),
  title: z.string(),
  company: z.string(),
  city: z.string().nullable(),
  country: z.string().nullable(),
  workMode: z.enum(WorkModeEnum).nullable(),
  level: z.enum(SeniorityLevelEnum).nullable(),
  stage: z.enum(VacancyStageEnum),
  skipReason: z.string().nullable(),
  source: z.string(),
  url: z.string(),
  textURL: z.string().nullable(),
  firstSeenAt: z.string(),
  lastSeenAt: z.string(),
  closedAt: z.string().nullable(),
  extraction: z
    .object({
      summary: z.string(),
      programmingLanguages: z.array(z.object({ name: z.string(), required: z.boolean() })),
      frameworks: z.array(z.string()),
      yearsRequired: z.number().nullable(),
      hebrew: z.enum(HebrewRequirementEnum)
    })
    .nullable(),
  matches: z.array(
    z.object({
      profile: z.string(),
      verdict: z.enum(VacancyMatchVerdictEnum),
      findings: z.array(z.object({ rule: z.string(), effect: z.enum(VacancyMatchVerdictEnum), message: z.string() })),
      notifiedAt: z.string().nullable()
    })
  ),
  actions: z.array(z.object({ kind: z.enum(VacancyActionKindEnum), at: z.string() }))
}) satisfies z.ZodType<IVacancyCard>;

/**
 * Validated answer of `GET /api/vacancies/:id`
 */
export type VacancyCardType = z.infer<typeof vacancyCardSchema>;
