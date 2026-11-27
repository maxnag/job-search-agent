import { DEFAULT_VACANCY_PAGE_SIZE, SortOrderEnum, VacancySortEnum } from '@job-agent/shared';

import { VACANCY_SEARCH_DEFAULTS, type VacancySearchType, vacancySearchSchema } from './vacancy-search.schema';

/**
 * Read the filters of the list from the query of the address
 *
 * @param {Record<string, string | string[] | undefined> | URLSearchParams} query
 *
 * @returns {VacancySearchType}
 */
export function parseVacancySearch(query: Record<string, string | string[] | undefined> | URLSearchParams): VacancySearchType {
  if (query instanceof URLSearchParams) {
    const record: Record<string, string | string[]> = {};

    for (const key of new Set(query.keys())) {
      const values = query.getAll(key);

      record[key] = values.length > 1 ? values : (values[0] ?? '');
    }

    return vacancySearchSchema.parse(record);
  }

  return vacancySearchSchema.parse(query);
}

/**
 * True when two lists hold the same values, order aside
 *
 * @param {readonly string[]} left
 * @param {readonly string[]} right
 *
 * @returns {boolean}
 */
function sameValues(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every(value => right.includes(value));
}

/**
 * Write the filters of the list as a query of the address. A default value is left out, so a link stays short; a list
 * the owner emptied is written as one empty value, so it does not fall back to its default
 *
 * @param {VacancySearchType} search
 *
 * @returns {URLSearchParams}
 */
export function toVacancyQuery(search: VacancySearchType): URLSearchParams {
  const query = new URLSearchParams();
  const lists: [string, readonly string[], readonly string[]][] = [
    ['stage', search.stage, VACANCY_SEARCH_DEFAULTS.stage],
    ['verdict', search.verdict, VACANCY_SEARCH_DEFAULTS.verdict],
    ['country', search.country, VACANCY_SEARCH_DEFAULTS.country],
    ['level', search.level, VACANCY_SEARCH_DEFAULTS.level],
    ['lastAction', search.lastAction, VACANCY_SEARCH_DEFAULTS.lastAction]
  ];

  for (const [key, values, defaults] of lists) {
    if (sameValues(values, defaults)) {
      continue;
    }

    if (values.length === 0) {
      query.set(key, '');
    }

    for (const value of values) {
      query.append(key, value);
    }
  }

  const single: [string, string | number | boolean | undefined][] = [
    ['sourceId', search.sourceId],
    ['city', search.city],
    ['workMode', search.workMode],
    ['sinceDays', search.sinceDays === VACANCY_SEARCH_DEFAULTS.sinceDays ? undefined : (search.sinceDays ?? '')],
    ['q', search.q],
    ['reason', search.reason],
    ['company', search.company],
    ['closed', search.closed],
    ['sort', search.sort === VacancySortEnum.FIRST_SEEN_AT ? undefined : search.sort],
    ['order', search.order === SortOrderEnum.DESC ? undefined : search.order],
    ['page', search.page === 1 ? undefined : search.page],
    ['pageSize', search.pageSize === DEFAULT_VACANCY_PAGE_SIZE ? undefined : search.pageSize]
  ];

  for (const [key, value] of single) {
    if (value !== undefined) {
      query.set(key, String(value));
    }
  }

  return query;
}

/**
 * Write the filters of the list as the query of the API: every filter in force, the defaults included, and nothing
 * for a filter set to any — the API knows no defaults of the page
 *
 * @param {VacancySearchType} search
 *
 * @returns {URLSearchParams}
 */
export function toVacancyAPIQuery(search: VacancySearchType): URLSearchParams {
  const query = new URLSearchParams();

  for (const [key, values] of [
    ['stage', search.stage],
    ['verdict', search.verdict],
    ['country', search.country],
    ['level', search.level],
    ['lastAction', search.lastAction]
  ] as const) {
    for (const value of values) {
      query.append(key, value);
    }
  }

  const single: [string, string | number | boolean | undefined][] = [
    ['sourceId', search.sourceId],
    ['city', search.city],
    ['workMode', search.workMode],
    ['sinceDays', search.sinceDays],
    ['q', search.q],
    ['reason', search.reason],
    ['company', search.company],
    ['closed', search.closed],
    ['sort', search.sort],
    ['order', search.order],
    ['page', search.page],
    ['pageSize', search.pageSize]
  ];

  for (const [key, value] of single) {
    if (value !== undefined) {
      query.set(key, String(value));
    }
  }

  return query;
}
