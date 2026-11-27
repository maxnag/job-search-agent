import { z } from 'zod';

import { type IVacancyActionAnswer, VacancyActionKindEnum } from '@job-agent/shared';

/**
 * Answer of `POST /api/vacancies/:id/actions`
 */
export const vacancyActionAnswerSchema = z.object({
  kind: z.enum(VacancyActionKindEnum),
  recorded: z.boolean()
}) satisfies z.ZodType<IVacancyActionAnswer>;

/**
 * Validated answer of `POST /api/vacancies/:id/actions`
 */
export type VacancyActionAnswerType = z.infer<typeof vacancyActionAnswerSchema>;
