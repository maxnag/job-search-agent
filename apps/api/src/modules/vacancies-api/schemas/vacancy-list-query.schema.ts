import { z } from 'zod';

import {
  DEFAULT_VACANCY_PAGE_SIZE,
  SeniorityLevelEnum,
  SortOrderEnum,
  VACANCY_PAGE_SIZES,
  VacancyLastActionEnum,
  VacancyMatchVerdictEnum,
  VacancySortEnum,
  VacancyStageEnum,
  WorkModeEnum
} from '@job-agent/shared';

/**
 * A query value that may come once or repeated — always a list
 *
 * @param {TItem} item
 *
 * @template TItem
 *
 * @returns {z.ZodType}
 */
function list<TItem extends z.ZodType>(item: TItem) {
  return z.preprocess(value => (value === undefined || Array.isArray(value) ? value : [value]), z.array(item).optional());
}

/**
 * Query of `GET /api/vacancies`: the filter of the list, its order and its page
 */
export const vacancyListQuerySchema = z.object({
  stage: list(z.enum(VacancyStageEnum)),
  verdict: list(z.enum(VacancyMatchVerdictEnum)),
  sourceId: list(z.coerce.number().int().positive()),
  reason: z.string().trim().min(1).optional(),
  country: list(z.string().trim().length(2)),
  city: z.string().trim().min(1).optional(),
  workMode: z.enum(WorkModeEnum).optional(),
  level: list(z.enum(SeniorityLevelEnum)),
  company: z.string().trim().min(1).optional(),
  q: z.string().trim().min(1).optional(),
  lastAction: list(z.enum(VacancyLastActionEnum)),
  sinceDays: z.coerce.number().int().positive().optional(),
  closed: z.stringbool().optional(),
  sort: z.enum(VacancySortEnum).default(VacancySortEnum.FIRST_SEEN_AT),
  order: z.enum(SortOrderEnum).default(SortOrderEnum.DESC),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce
    .number()
    .int()
    .refine(size => VACANCY_PAGE_SIZES.includes(size))
    .default(DEFAULT_VACANCY_PAGE_SIZE)
});

/**
 * Parsed query of `GET /api/vacancies`
 */
export type VacancyListQueryType = z.output<typeof vacancyListQuerySchema>;
