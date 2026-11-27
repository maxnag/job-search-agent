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
 * Periods the list offers, in days
 *
 * @type {readonly number[]}
 */
export const VACANCY_PERIODS: readonly number[] = [1, 3, 7, 14, 30];

/**
 * What the list shows when its address names no filter: open positions in Israel and Ukraine, senior and above, that
 * fit or almost fit, not skipped by the owner, found in the last three days. A filter the owner clears is kept in the
 * address as an empty value (`country=`), so "any" stays apart from "the default"
 */
export const VACANCY_SEARCH_DEFAULTS = {
  stage: [VacancyStageEnum.LISTED, VacancyStageEnum.EXTRACTED],
  verdict: [VacancyMatchVerdictEnum.FIT, VacancyMatchVerdictEnum.ALMOST],
  country: ['IL', 'UA'],
  level: [SeniorityLevelEnum.SENIOR, SeniorityLevelEnum.STAFF, SeniorityLevelEnum.PRINCIPAL],
  lastAction: [VacancyLastActionEnum.INTERESTED, VacancyLastActionEnum.APPLIED, VacancyLastActionEnum.NONE],
  sinceDays: 3
} as const;

/**
 * A text of the query: trimmed, an empty one is no filter
 */
const text = z
  .string()
  .trim()
  .transform(value => value || undefined)
  .optional()
  .catch(undefined);

/**
 * A list of the query: missing — the default; present — its valid values, so an empty value means any. Unknown values
 * are dropped, never an error
 *
 * @param {z.ZodType<TItem>} item
 * @param {readonly TItem[]} defaults
 *
 * @template TItem
 *
 * @returns {z.ZodType<TItem[]>}
 */
function list<TItem>(item: z.ZodType<TItem>, defaults: readonly TItem[]) {
  return z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform(value =>
      value === undefined
        ? [...defaults]
        : [value].flat().flatMap(entry => {
            const parsed = item.safeParse(entry);

            return parsed.success ? [parsed.data] : [];
          })
    )
    .catch([...defaults]);
}

/**
 * A country code of the query, upper case
 */
const countryCode = z
  .string()
  .trim()
  .length(2)
  .transform(value => value.toUpperCase());

/**
 * Filters, order and page of the list of vacancies as the address of the page carries them. A wrong value falls back
 * to its default — a hand-edited link never breaks the page
 */
export const vacancySearchSchema = z.object({
  stage: list(z.enum(VacancyStageEnum), VACANCY_SEARCH_DEFAULTS.stage),
  verdict: list(z.enum(VacancyMatchVerdictEnum), VACANCY_SEARCH_DEFAULTS.verdict),
  country: list(countryCode, VACANCY_SEARCH_DEFAULTS.country),
  level: list(z.enum(SeniorityLevelEnum), VACANCY_SEARCH_DEFAULTS.level),
  sourceId: z.coerce.number().int().positive().optional().catch(undefined),
  city: text,
  workMode: z.enum(WorkModeEnum).optional().catch(undefined),
  lastAction: list(z.enum(VacancyLastActionEnum), VACANCY_SEARCH_DEFAULTS.lastAction),
  sinceDays: z
    .string()
    .optional()
    .transform(value => {
      if (value === undefined) {
        return VACANCY_SEARCH_DEFAULTS.sinceDays;
      }

      const days = +value;

      return VACANCY_PERIODS.includes(days) ? days : undefined;
    })
    .catch(VACANCY_SEARCH_DEFAULTS.sinceDays),
  q: text,
  reason: text,
  company: text,
  closed: z
    .literal('true')
    .transform(() => true)
    .optional()
    .catch(undefined),
  sort: z.enum(VacancySortEnum).default(VacancySortEnum.FIRST_SEEN_AT).catch(VacancySortEnum.FIRST_SEEN_AT),
  order: z.enum(SortOrderEnum).default(SortOrderEnum.DESC).catch(SortOrderEnum.DESC),
  page: z.coerce.number().int().positive().default(1).catch(1),
  pageSize: z.coerce
    .number()
    .int()
    .refine(size => VACANCY_PAGE_SIZES.includes(size))
    .default(DEFAULT_VACANCY_PAGE_SIZE)
    .catch(DEFAULT_VACANCY_PAGE_SIZE)
});

/**
 * Filters, order and page of the list of vacancies
 */
export type VacancySearchType = z.output<typeof vacancySearchSchema>;
