import { z } from 'zod';

import { VacancyActionKindEnum } from '@job-agent/shared';

/**
 * Body of `POST /api/vacancies/:id/actions`
 */
export const vacancyActionBodySchema = z.object({
  kind: z.enum(VacancyActionKindEnum)
});

/**
 * Parsed body of `POST /api/vacancies/:id/actions`
 */
export type VacancyActionBodyType = z.output<typeof vacancyActionBodySchema>;
