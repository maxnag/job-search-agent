import { describe, expect, it } from 'vitest';

import {
  SeniorityLevelEnum,
  SortOrderEnum,
  VacancyLastActionEnum,
  VacancyMatchVerdictEnum,
  VacancySortEnum,
  VacancyStageEnum
} from '@job-agent/shared';

import { vacancyListQuerySchema } from './vacancy-list-query.schema.js';

describe('vacancyListQuerySchema', () => {
  it('fills the order and the page by default and leaves every filter out', () => {
    expect(vacancyListQuerySchema.parse({})).toEqual({
      sort: VacancySortEnum.FIRST_SEEN_AT,
      order: SortOrderEnum.DESC,
      page: 1,
      pageSize: 25
    });
  });

  it('takes a list filter given once or repeated', () => {
    expect(
      vacancyListQuerySchema.parse({
        stage: 'listed',
        verdict: ['fit', 'almost'],
        country: ['IL', 'UA'],
        level: 'senior',
        lastAction: ['interested', 'none'],
        sourceId: ['3', '5']
      })
    ).toMatchObject({
      stage: [VacancyStageEnum.LISTED],
      verdict: [VacancyMatchVerdictEnum.FIT, VacancyMatchVerdictEnum.ALMOST],
      country: ['IL', 'UA'],
      level: [SeniorityLevelEnum.SENIOR],
      lastAction: [VacancyLastActionEnum.INTERESTED, VacancyLastActionEnum.NONE],
      sourceId: [3, 5]
    });
  });

  it('reads the numbers and the flag of the query', () => {
    expect(vacancyListQuerySchema.parse({ sinceDays: '3', closed: 'true', page: '2', pageSize: '50' })).toMatchObject({
      sinceDays: 3,
      closed: true,
      page: 2,
      pageSize: 50
    });
  });

  it.each([
    ['an unknown stage', { stage: 'archived' }],
    ['a country that is no code', { country: 'Israel' }],
    ['a page size the list does not offer', { pageSize: '30' }],
    ['a page below one', { page: '0' }],
    ['an unknown sort', { sort: 'salary' }],
    ['an empty search', { q: '   ' }]
  ])('refuses %s', (_case, query) => {
    expect(vacancyListQuerySchema.safeParse(query).success).toBe(false);
  });
});
