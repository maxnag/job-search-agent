import { z } from 'zod';

import type { IVacancyFilterOptions } from '@job-agent/shared';

/**
 * Answer of `GET /api/vacancies/filters` — the values the filters of the list offer
 */
export const vacancyFilterOptionsSchema = z.object({
  sources: z.array(z.object({ sourceId: z.number().int(), name: z.string() })),
  countries: z.array(z.string()),
  cities: z.array(z.object({ country: z.string().nullable(), city: z.string() }))
}) satisfies z.ZodType<IVacancyFilterOptions>;

/**
 * Validated answer of `GET /api/vacancies/filters`
 */
export type VacancyFilterOptionsType = z.infer<typeof vacancyFilterOptionsSchema>;
